import { useCallback, useEffect, useRef, useState } from 'react'
import { speakLine, transcribeClip } from './api.js'

// Plays one line at a time across the whole transcript: starting a new line
// stops whichever was playing, so two voices never overlap.
//
// Word highlighting is driven by requestAnimationFrame reading the audio
// element's own currentTime rather than by timers started at play time. Timers
// drift as soon as the audio stalls to buffer; currentTime cannot.
export function useSpeech(sessionId) {
  // { messageId, words, index } for the line currently speaking.
  const [speaking, setSpeaking] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError] = useState(null)

  const audioRef = useRef(null)
  const frameRef = useRef(0)
  // Bumped on every stop so a slow synthesis request that lands late cannot
  // start playing over whatever the user has since chosen.
  const runRef = useRef(0)

  const stop = useCallback(() => {
    runRef.current += 1
    cancelAnimationFrame(frameRef.current)
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      URL.revokeObjectURL(audio.src)
      audioRef.current = null
    }
    setSpeaking(null)
    setLoadingId(null)
  }, [])

  // Never leave audio playing after the chat screen goes away.
  useEffect(() => stop, [stop])

  const speak = useCallback(
    async (message, speed) => {
      stop()
      const run = runRef.current
      setError(null)
      setLoadingId(message.id)

      let data
      try {
        data = await speakLine(sessionId, message.text, speed)
      } catch (err) {
        if (run === runRef.current) {
          setError(err.message)
          setLoadingId(null)
        }
        return
      }

      // The user stopped it, or started another line, while we were waiting.
      if (run !== runRef.current) return

      const audio = new Audio(base64ToUrl(data.audio, data.mime))
      audioRef.current = audio
      const words = data.words ?? []

      const follow = () => {
        // Words are in order, so a linear scan of a 1-3 sentence line is
        // cheaper than anything cleverer.
        const at = audio.currentTime
        let index = -1
        for (let i = 0; i < words.length; i += 1) {
          if (at >= words[i].start && at < words[i].end) {
            index = i
            break
          }
        }
        setSpeaking((current) =>
          current && current.index === index ? current : { messageId: message.id, words, index },
        )
        frameRef.current = requestAnimationFrame(follow)
      }

      const finish = () => {
        if (run === runRef.current) stop()
      }
      audio.addEventListener('ended', finish)
      audio.addEventListener('error', () => {
        if (run !== runRef.current) return
        setError('That clip could not be played.')
        stop()
      })

      setLoadingId(null)
      setSpeaking({ messageId: message.id, words, index: -1 })

      try {
        await audio.play()
        frameRef.current = requestAnimationFrame(follow)
      } catch {
        // Autoplay was blocked, or playback was interrupted by a new line.
        if (run === runRef.current) {
          setError('The browser blocked playback. Click the play button again.')
          stop()
        }
      }
    },
    [sessionId, stop],
  )

  return { speaking, loadingId, error, speak, stop, clearError: () => setError(null) }
}

function base64ToUrl(base64, mime) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

// MediaRecorder's default container varies by browser; Safari has no webm.
function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? ''
}

export const RECORDING_SUPPORTED =
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia

// Records from the mic and sends the clip for transcription. The transcript is
// handed back rather than sent, so the user can fix it before replying.
export function useRecorder(sessionId, onTranscript) {
  const [state, setState] = useState('idle') // idle | recording | transcribing
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  // Set when the user cancels, so the stop handler drops the audio instead of
  // transcribing it.
  const discardRef = useRef(false)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  // Release the mic if the screen unmounts mid-recording.
  useEffect(
    () => () => {
      try {
        recorderRef.current?.stop()
      } catch {
        // Already stopped.
      }
      releaseStream()
    },
    [releaseStream],
  )

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setError(null)

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser to speak.'
          : 'No microphone was found.',
      )
      return
    }

    streamRef.current = stream
    chunksRef.current = []
    discardRef.current = false

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    })

    recorder.addEventListener('stop', async () => {
      releaseStream()
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      chunksRef.current = []

      if (discardRef.current) {
        setState('idle')
        return
      }

      setState('transcribing')
      try {
        const data = await transcribeClip(sessionId, blob)
        onTranscript(data.text)
      } catch (err) {
        setError(err.message)
      } finally {
        setState('idle')
      }
    })

    recorder.start()
    setState('recording')
  }, [onTranscript, releaseStream, sessionId, state])

  const stop = useCallback(
    ({ discard = false } = {}) => {
      if (state !== 'recording') return
      discardRef.current = discard
      try {
        recorderRef.current?.stop()
      } catch {
        setState('idle')
      }
    },
    [state],
  )

  return { state, error, start, stop, clearError: () => setError(null) }
}
