async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = await response.json()
      if (body?.detail) detail = body.detail
    } catch {
      // Non-JSON error body — keep the status-code message.
    }
    const error = new Error(detail)
    error.status = response.status
    throw error
  }

  return response.json()
}

export function fetchConfig() {
  return request('/api/config')
}

export function createSession({ language, scenario, scenarioTitle }) {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      language,
      scenario,
      scenario_title: scenarioTitle,
    }),
  })
}

export function sendMessage(sessionId, text) {
  return request(`/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function translateLine(sessionId, text) {
  return request(`/api/sessions/${sessionId}/translate`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

// Speaks one line and returns base64 audio plus the per-word timings the
// chat uses to highlight along with the voice.
export function speakLine(sessionId, text, speed) {
  return request(`/api/sessions/${sessionId}/speak`, {
    method: 'POST',
    body: JSON.stringify(speed === undefined ? { text } : { text, speed }),
  })
}

// Sends a recorded clip for transcription. No Content-Type header here on
// purpose — the browser has to set the multipart boundary itself.
export async function transcribeClip(sessionId, blob) {
  const form = new FormData()
  const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
  form.append('audio', blob, `reply.${extension}`)

  const response = await fetch(`/api/sessions/${sessionId}/transcribe`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    let detail = `Transcription failed (${response.status})`
    try {
      const body = await response.json()
      if (body?.detail) detail = body.detail
    } catch {
      // Non-JSON error body — keep the status-code message.
    }
    const error = new Error(detail)
    error.status = response.status
    throw error
  }

  return response.json()
}

export function endSession(sessionId) {
  return request(`/api/sessions/${sessionId}/end`, { method: 'POST' })
}
