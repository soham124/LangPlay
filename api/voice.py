"""ElevenLabs speech synthesis and recognition for the web UI.

Kept apart from `main.py` so the roleplay endpoints stay readable. Everything
here is optional: with no ELEVENLABS_API_KEY the app runs exactly as it did
before, and the UI hides its voice controls rather than offering dead buttons.
"""

import base64
import os

import httpx
from fastapi import HTTPException

from langplay_prompt import (
    STT_MODEL,
    TTS_MODEL,
    TTS_SPEED,
    TTS_VOICE_PREFERENCES,
    TTS_VOICE_SETTINGS,
)

API_ROOT = "https://api.elevenlabs.io"

# Synthesis of a 1-3 sentence line is quick, but transcription uploads a file
# and occasionally queues, so it gets the longer budget.
TTS_TIMEOUT = 60.0
STT_TIMEOUT = 120.0

# mp3 plays everywhere <audio> does, and keeps the base64 payload small enough
# to hand back inline rather than needing a second request for the bytes.
OUTPUT_FORMAT = "mp3_44100_128"

_voice_id: str | None = None


# Both spellings are accepted because the service is written "ElevenLabs" but
# reads as two words, and a key under the wrong name would otherwise look
# exactly like no key at all.
KEY_VARIABLES = ("ELEVENLABS_API_KEY", "ELEVEN_LABS_API_KEY")
VOICE_VARIABLES = ("ELEVENLABS_VOICE_ID", "ELEVEN_LABS_VOICE_ID")


def _first_set(names: tuple[str, ...]) -> str | None:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return None


def api_key() -> str | None:
    return _first_set(KEY_VARIABLES)


def enabled() -> bool:
    return api_key() is not None


def _require_key() -> str:
    key = api_key()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Voice is off. Add ELEVENLABS_API_KEY to the .env file in the project root.",
        )
    return key


def _fail(action: str, exc: Exception) -> HTTPException:
    """Turn an httpx failure into something the UI can show a learner."""
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 401:
            return HTTPException(status_code=502, detail="ElevenLabs rejected the API key.")
        if status == 402:
            return HTTPException(
                status_code=502,
                detail=(
                    "ElevenLabs rejected this voice on a free plan. Free accounts cannot "
                    "use library voices via the API — set ELEVENLABS_VOICE_ID in .env to a "
                    "voice from your own VoiceLab, or upgrade the plan."
                ),
            )
        if status == 429:
            return HTTPException(
                status_code=502,
                detail="ElevenLabs rate limit or quota reached. Try again in a moment.",
            )
        detail = exc.response.text[:200]
        return HTTPException(status_code=502, detail=f"{action} failed ({status}): {detail}")
    if isinstance(exc, httpx.TimeoutException):
        return HTTPException(status_code=504, detail=f"{action} timed out.")
    return HTTPException(status_code=502, detail=f"{action} failed: {exc}")


def resolve_voice_id() -> str:
    """Pick a voice once per process and remember it.

    Prefers ELEVENLABS_VOICE_ID, then the first name in TTS_VOICE_PREFERENCES
    the account actually has. Premade voice IDs are not hardcoded because
    ElevenLabs retires them and silently remaps the old IDs to other voices.
    """
    global _voice_id
    if _voice_id:
        return _voice_id

    configured = _first_set(VOICE_VARIABLES)
    if configured:
        _voice_id = configured
        return _voice_id

    key = _require_key()
    try:
        response = httpx.get(
            f"{API_ROOT}/v2/voices",
            headers={"xi-api-key": key},
            params={"page_size": 100},
            timeout=TTS_TIMEOUT,
        )
        response.raise_for_status()
        voices = response.json().get("voices", [])
    except httpx.HTTPStatusError as exc:
        # A key scoped without `voices_read` cannot browse the account, but may
        # still synthesise. Point at the one setting that resolves it rather
        # than reporting this as a generic listing failure.
        if exc.response.status_code in (401, 403):
            raise HTTPException(
                status_code=502,
                detail=(
                    "This ElevenLabs key cannot list voices (needs the voices_read "
                    "permission). Set ELEVENLABS_VOICE_ID in .env to choose a voice "
                    "directly, or enable voices_read on the key."
                ),
            ) from exc
        raise _fail("Listing voices", exc) from exc
    except Exception as exc:
        raise _fail("Listing voices", exc) from exc

    if not voices:
        raise HTTPException(
            status_code=502,
            detail="No ElevenLabs voices are available on this account.",
        )

    names = [((v.get("name") or "").strip().lower(), v) for v in voices]
    for preferred in TTS_VOICE_PREFERENCES:
        want = preferred.lower()
        # Exact match first, then a prefix match so library voices carrying a
        # descriptive suffix ("Julian - Warm, articulate") still resolve.
        for name, voice in names:
            if name == want:
                _voice_id = voice["voice_id"]
                return _voice_id
        for name, voice in names:
            if name.startswith(want):
                _voice_id = voice["voice_id"]
                return _voice_id

    # Nothing preferred is on this account. Prefer a professional voice over an
    # arbitrary clone, which is likely to be someone's personal recording.
    professional = next((v for v in voices if v.get("category") == "professional"), None)
    _voice_id = (professional or voices[0])["voice_id"]
    return _voice_id


def word_timings(alignment: dict, text: str) -> list[dict]:
    """Fold ElevenLabs' per-character timings into per-word spans.

    The UI highlights whole words as they are spoken, so it needs the index
    range each word occupies in the original string plus the seconds it is
    audible. Characters come back aligned to the exact text we submitted, so
    the indices can be applied to that string directly.
    """
    characters = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    if not characters or len(characters) != len(starts) or len(characters) != len(ends):
        return []

    words: list[dict] = []
    current: dict | None = None

    for index, char in enumerate(characters):
        if char.isspace():
            current = None
            continue
        if current is None:
            current = {"start_index": index, "end_index": index + 1,
                       "start": starts[index], "end": ends[index]}
            words.append(current)
        else:
            current["end_index"] = index + 1
            current["end"] = ends[index]

    # Guard against alignment drifting out of step with the submitted text:
    # a bad index range would highlight the wrong span, so drop the timings
    # and let the UI fall back to plain playback.
    if any(w["end_index"] > len(text) for w in words):
        return []
    return words


def synthesize(text: str, language_iso: str | None, speed: float = TTS_SPEED) -> dict:
    """Speak one line slowly, with the timings needed to follow along."""
    key = _require_key()
    voice_id = resolve_voice_id()

    body: dict = {
        "text": text,
        "model_id": TTS_MODEL,
        "voice_settings": {**TTS_VOICE_SETTINGS, "speed": speed},
    }
    if language_iso:
        body["language_code"] = language_iso

    try:
        response = httpx.post(
            f"{API_ROOT}/v1/text-to-speech/{voice_id}/with-timestamps",
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            params={"output_format": OUTPUT_FORMAT},
            json=body,
            timeout=TTS_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        raise _fail("Speech synthesis", exc) from exc

    audio = data.get("audio_base64")
    if not audio:
        raise HTTPException(status_code=502, detail="ElevenLabs returned no audio.")

    # `alignment` maps to the text we sent; `normalized_alignment` maps to the
    # expanded form ("12" -> "twelve"), whose indices would not line up.
    return {
        "audio": audio,
        "mime": "audio/mpeg",
        "speed": speed,
        "words": word_timings(data.get("alignment") or {}, text),
    }


def transcribe(audio: bytes, filename: str, content_type: str, language_iso: str | None) -> str:
    """Turn a recorded clip into text in the language being practised."""
    key = _require_key()

    data = {"model_id": STT_MODEL}
    if language_iso:
        # Pinning the language stops Scribe from "helpfully" transcribing a
        # halting beginner sentence as the user's native tongue.
        data["language_code"] = language_iso

    try:
        response = httpx.post(
            f"{API_ROOT}/v1/speech-to-text",
            headers={"xi-api-key": key},  # httpx sets the multipart boundary
            files={"file": (filename, audio, content_type)},
            data=data,
            timeout=STT_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        raise _fail("Transcription", exc) from exc

    return (payload.get("text") or "").strip()
