"""FastAPI backend for the LangPlay web UI.

Wraps the same Gemini roleplay chat the CLI uses, holding one chat session per
browser tab in memory. Restarting the server clears all sessions — that is
intentional for a local practice tool; nothing here is meant to be persisted.
"""

import os
import re
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import voice  # noqa: E402
from langplay_prompt import (  # noqa: E402
    LANGUAGES,
    TTS_SPEED,
    iso_code_for,
    MODEL,
    OPENING_INSTRUCTION,
    SCENARIOS,
    TEMPERATURE,
    TRANSLATION_TEMPERATURE,
    build_system_prompt,
    build_translation_prompt,
    farewell_for,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="LangPlay API")

# The Vite dev server runs on a different port, so the browser needs CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

_client: genai.Client | None = None
_sessions: dict[str, dict] = {}

# A correction only counts if the model put it at the very start of the reply,
# which is what the system prompt asks for.
_CORRECTION_RE = re.compile(r"^\s*\[([^\]]+)\]\s*")


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="GEMINI_API_KEY is not set. Add it to the .env file in the project root.",
            )
        _client = genai.Client(api_key=api_key)
    return _client


def split_correction(text: str) -> tuple[str | None, str]:
    """Pull a leading [correction] off the reply so the UI can style it separately."""
    match = _CORRECTION_RE.match(text)
    if not match:
        return None, text.strip()
    return match.group(1).strip(), text[match.end() :].strip()


def get_session(session_id: str) -> dict:
    session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="That practice session has expired. Start a new one.",
        )
    return session


def send(session: dict, message: str) -> dict:
    """Send one turn to Gemini and return the reply split into its parts."""
    try:
        response = session["chat"].send_message(message)
    except Exception as exc:  # the SDK raises a variety of transport/API errors
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc

    correction, line = split_correction(response.text or "")
    if correction:
        session["corrections"].append(correction)
    return {
        "line": line,
        "correction": correction,
        "stats": session_stats(session),
    }


def session_stats(session: dict) -> dict:
    return {
        "turns": session["turns"],
        "corrections": len(session["corrections"]),
    }


class NewSession(BaseModel):
    language: str = Field(min_length=1, max_length=40)
    scenario: str = Field(min_length=1, max_length=400)
    scenario_title: str | None = Field(default=None, max_length=120)


class UserMessage(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    # ElevenLabs clamps speed to this range; rejecting it here gives a clearer
    # error than a 422 from their API.
    speed: float = Field(default=TTS_SPEED, ge=0.7, le=1.2)


@app.get("/api/config")
def config() -> dict:
    """Everything the setup screen needs to render its choices."""
    return {
        "languages": LANGUAGES,
        "scenarios": SCENARIOS,
        "voice_enabled": voice.enabled(),
    }


@app.post("/api/sessions")
def create_session(body: NewSession) -> dict:
    client = get_client()
    chat = client.chats.create(
        model=MODEL,
        config=types.GenerateContentConfig(
            system_instruction=build_system_prompt(body.language, body.scenario),
            temperature=TEMPERATURE,
        ),
    )

    session_id = uuid.uuid4().hex
    session = {
        "chat": chat,
        "language": body.language,
        "scenario": body.scenario,
        "scenario_title": body.scenario_title or body.scenario,
        "turns": 0,
        "corrections": [],
        # Hover translations, keyed by source text, so re-hovering is free.
        "translations": {},
    }
    _sessions[session_id] = session

    # Let the character speak first so the user is answering, not initiating.
    opening = send(session, OPENING_INSTRUCTION)
    return {
        "session_id": session_id,
        "language": session["language"],
        "scenario_title": session["scenario_title"],
        "opening": opening,
    }


@app.post("/api/sessions/{session_id}/messages")
def post_message(session_id: str, body: UserMessage) -> dict:
    session = get_session(session_id)
    session["turns"] += 1
    return send(session, body.text)


@app.post("/api/sessions/{session_id}/translate")
def translate(session_id: str, body: TranslateRequest) -> dict:
    """Translate one line of the transcript into English for the hover tooltip.

    Runs as a standalone request against the model rather than through the
    session's chat, so the roleplay history stays purely in the target language.
    """
    session = get_session(session_id)
    text = body.text.strip()

    cached = session["translations"].get(text)
    if cached is not None:
        return {"translation": cached, "cached": True}

    client = get_client()
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=text,
            config=types.GenerateContentConfig(
                system_instruction=build_translation_prompt(session["language"]),
                temperature=TRANSLATION_TEMPERATURE,
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Translation failed: {exc}") from exc

    translation = (response.text or "").strip()
    if not translation:
        raise HTTPException(status_code=502, detail="The model returned an empty translation.")

    session["translations"][text] = translation
    return {"translation": translation, "cached": False}


@app.post("/api/sessions/{session_id}/speak")
def speak(session_id: str, body: SpeakRequest) -> dict:
    """Read one line aloud slowly, with per-word timings for follow-along.

    Audio is not cached the way translations are: a clip is far larger than a
    sentence of text, and the browser already holds the one it is playing.
    """
    session = get_session(session_id)
    return voice.synthesize(
        body.text.strip(),
        iso_code_for(session["language"]),
        speed=body.speed,
    )


@app.post("/api/sessions/{session_id}/transcribe")
async def transcribe(session_id: str, audio: UploadFile = File(...)) -> dict:
    """Turn a recorded reply into text in the language being practised."""
    session = get_session(session_id)

    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="The recording was empty.")
    # ElevenLabs needs at least 100ms of audio; a stray click is not a reply.
    if len(data) < 1024:
        raise HTTPException(
            status_code=400,
            detail="That recording was too short. Hold the mic button while you speak.",
        )

    text = voice.transcribe(
        data,
        audio.filename or "reply.webm",
        audio.content_type or "audio/webm",
        iso_code_for(session["language"]),
    )
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Nothing was picked up. Try again, a little closer to the mic.",
        )
    return {"text": text}


@app.post("/api/sessions/{session_id}/end")
def end_session(session_id: str) -> dict:
    session = get_session(session_id)
    summary = {
        "farewell": farewell_for(session["language"]),
        "language": session["language"],
        "scenario_title": session["scenario_title"],
        "corrections": session["corrections"],
        "stats": session_stats(session),
    }
    _sessions.pop(session_id, None)
    return summary


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "key_configured": bool(os.getenv("GEMINI_API_KEY")),
        "voice_enabled": voice.enabled(),
    }
