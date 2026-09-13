import { useCallback, useEffect, useRef, useState } from 'react'
import { translateLine } from '../api.js'
import { RECORDING_SUPPORTED, useRecorder, useSpeech } from '../voice.js'

// Splits a line into words and the whitespace between them, so playback can
// highlight one word while leaving the sentence visually intact. `start` is the
// index in the original string, which is what the backend's timings refer to.
function segment(text) {
  const parts = []
  const spaces = /\s+/g
  let cursor = 0
  let match

  while ((match = spaces.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index), word: true, start: cursor })
    }
    parts.push({ text: match[0], word: false, start: match.index })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), word: true, start: cursor })
  }
  return parts
}

// The reply text, with the word currently being spoken picked out. Falls back
// to plain text whenever nothing is playing or the timings came back unusable.
function SpokenText({ text, spoken }) {
  if (!spoken || !spoken.words.length) return text

  const active = spoken.index >= 0 ? spoken.words[spoken.index] : null
  return segment(text).map((part, index) => {
    const isActive =
      part.word && active && part.start >= active.start_index && part.start < active.end_index

    return isActive ? (
      <mark className="spoken" key={index}>
        {part.text}
      </mark>
    ) : (
      <span key={index}>{part.text}</span>
    )
  })
}

// One received line, with its English translation revealed on hover.
// Hover is the primary gesture, but the EN button pins it open so the feature
// also works with a keyboard and on touch devices, which have no hover at all.
function BuddyTurn({
  message,
  translation,
  pinned,
  onReveal,
  onTogglePin,
  voiceEnabled,
  spoken,
  speechLoading,
  onSpeak,
  onStopSpeaking,
}) {
  const [hovered, setHovered] = useState(false)
  const open = hovered || pinned
  const playing = !!spoken

  function reveal() {
    setHovered(true)
    onReveal(message)
  }

  return (
    <div className="turn turn--buddy">
      <div className="turn__meta">
        <span className="turn__who">Your partner</span>

        {voiceEnabled && (
          <button
            type="button"
            className="speak-btn"
            aria-label={playing ? 'Stop reading this line' : 'Read this line aloud, slowly'}
            aria-pressed={playing}
            disabled={speechLoading}
            onClick={() => (playing ? onStopSpeaking() : onSpeak(message))}
          >
            {speechLoading ? '···' : playing ? '■ Stop' : '▶ Listen'}
          </button>
        )}

        <button
          type="button"
          className="translate-btn"
          aria-expanded={pinned}
          aria-label={pinned ? 'Hide English translation' : 'Show English translation'}
          onClick={() => {
            onTogglePin(message.id)
            onReveal(message)
          }}
        >
          {pinned ? 'EN ✕' : 'EN'}
        </button>
      </div>

      {message.correction && (
        <div className="correction">
          <span className="correction__tag">Fix</span>
          <span className="correction__text">{message.correction}</span>
        </div>
      )}

      {/* Bubble and translation share one hover region. Revealing the
          translation pushes it into view directly under the cursor, so if only
          the bubble listened for hover, that first movement downward would
          leave the hover area and close the very thing being reached for. */}
      <div
        className="say"
        onMouseEnter={reveal}
        onMouseLeave={() => setHovered(false)}
        onFocus={reveal}
        onBlur={(event) => {
          // Keep it open while focus moves between children of this region.
          if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false)
        }}
      >
        <div className={`bubble bubble--buddy${playing ? ' bubble--speaking' : ''}`} tabIndex={0}>
          <SpokenText text={message.text} spoken={spoken} />
        </div>

        {open && (
          <div className="translation" role="note">
            <span className="translation__tag">EN</span>
            {translation?.status === 'done' && (
              <span className="translation__text">{translation.text}</span>
            )}
            {translation?.status === 'error' && (
              <span className="translation__text">{translation.error}</span>
            )}
            {(!translation || translation.status === 'loading') && (
              <span className="translation__text translation__text--muted">
                Translating
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatScreen({ session, messages, waiting, onSend, voiceEnabled }) {
  const [draft, setDraft] = useState('')
  const [translations, setTranslations] = useState({})
  const [pinned, setPinned] = useState(() => new Set())
  const transcriptRef = useRef(null)
  const inputRef = useRef(null)

  const speech = useSpeech(session.id)

  // A transcript lands in the composer rather than being sent, so the user can
  // read back what was heard and fix it before committing to the reply.
  const handleTranscript = useCallback((text) => {
    setDraft((current) => (current ? `${current} ${text}` : text))
    inputRef.current?.focus()
  }, [])
  const recorder = useRecorder(session.id, handleTranscript)

  const canRecord = voiceEnabled && RECORDING_SUPPORTED
  const recording = recorder.state === 'recording'
  const transcribing = recorder.state === 'transcribing'
  const voiceError = speech.error || recorder.error

  // Tracks which lines have a request in flight or already resolved, so a hover
  // that flickers in and out does not fire duplicate calls.
  const requested = useRef(new Set())

  const revealTranslation = useCallback(
    async (message) => {
      if (requested.current.has(message.id)) return
      requested.current.add(message.id)
      setTranslations((current) => ({ ...current, [message.id]: { status: 'loading' } }))

      try {
        const data = await translateLine(session.id, message.text)
        setTranslations((current) => ({
          ...current,
          [message.id]: { status: 'done', text: data.translation },
        }))
      } catch (err) {
        // Drop the marker so the next hover retries.
        requested.current.delete(message.id)
        setTranslations((current) => ({
          ...current,
          [message.id]: { status: 'error', error: err.message },
        }))
      }
    },
    [session.id],
  )

  const togglePin = useCallback((id) => {
    setPinned((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Keep the newest turn in view as the scene unfolds.
  useEffect(() => {
    const node = transcriptRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, waiting])

  // Hand focus back to the composer once the reply lands.
  useEffect(() => {
    if (!waiting) inputRef.current?.focus()
  }, [waiting])

  function handleSubmit(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || waiting) return
    setDraft('')
    onSend(text)
  }

  return (
    <div className="chat">
      <div className="chat__head">
        <div className="chat__scene">
          <span className="chat__avatar">{session.emoji}</span>
          <div>
            <div className="chat__title">{session.scenarioTitle}</div>
            <div className="chat__sub">Speaking {session.language}</div>
          </div>
        </div>
        <span className="chip">🎭 In character</span>
      </div>

      <div className="transcript" ref={transcriptRef}>
        {messages.map((message) =>
          message.role === 'buddy' ? (
            <BuddyTurn
              key={message.id}
              message={message}
              translation={translations[message.id]}
              pinned={pinned.has(message.id)}
              onReveal={revealTranslation}
              onTogglePin={togglePin}
              voiceEnabled={voiceEnabled}
              spoken={speech.speaking?.messageId === message.id ? speech.speaking : null}
              speechLoading={speech.loadingId === message.id}
              onSpeak={speech.speak}
              onStopSpeaking={speech.stop}
            />
          ) : (
            <div className="turn turn--user" key={message.id}>
              <span className="turn__who">You</span>
              <div className="bubble bubble--user">{message.text}</div>
            </div>
          ),
        )}

        {waiting && (
          <div className="turn turn--buddy">
            <span className="turn__who">Your partner</span>
            <div className="typing" role="status" aria-label="Your partner is replying">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {voiceError && (
        <div className="voice-note voice-note--bad" role="alert">
          <span className="voice-note__text">{voiceError}</span>
          <button
            type="button"
            className="voice-note__action"
            onClick={() => {
              speech.clearError()
              recorder.clearError()
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {recording && (
        <div className="voice-note voice-note--live" role="status">
          <span className="rec-dot" />
          <span className="voice-note__text">
            Listening in {session.language} — press stop when you finish speaking.
          </span>
          <button
            type="button"
            className="voice-note__action"
            onClick={() => recorder.stop({ discard: true })}
          >
            Cancel
          </button>
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        {canRecord && (
          <button
            type="button"
            className={`btn btn--mic${recording ? ' btn--mic-live' : ''}`}
            aria-label={
              recording ? 'Stop recording and transcribe' : `Speak your reply in ${session.language}`
            }
            aria-pressed={recording}
            disabled={waiting || transcribing}
            onClick={() => (recording ? recorder.stop() : recorder.start())}
          >
            {transcribing ? '···' : recording ? '■' : '🎤'}
          </button>
        )}
        <input
          ref={inputRef}
          className="input"
          placeholder={
            transcribing ? 'Writing down what you said…' : `Reply in ${session.language}…`
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={waiting}
          maxLength={2000}
          autoFocus
        />
        <button type="submit" className="btn btn--green" disabled={waiting || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
