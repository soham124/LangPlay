import { useCallback, useEffect, useRef, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import ChatScreen from './components/ChatScreen.jsx'
import SummaryScreen from './components/SummaryScreen.jsx'
import { createSession, endSession, fetchConfig, sendMessage } from './api.js'

export default function App() {
  const [config, setConfig] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState(null)

  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState(null)
  const [waiting, setWaiting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [summary, setSummary] = useState(null)

  const nextId = useRef(0)
  const addMessage = useCallback((message) => {
    nextId.current += 1
    setMessages((current) => [...current, { id: nextId.current, ...message }])
  }, [])

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data)
        setPhase('setup')
      })
      .catch((err) => {
        setError(`Could not reach the API: ${err.message}`)
        setPhase('setup')
      })
  }, [])

  async function handleStart(choice) {
    setStarting(true)
    setError(null)
    try {
      const data = await createSession(choice)
      setSession({
        id: data.session_id,
        language: data.language,
        scenarioTitle: data.scenario_title,
        emoji: choice.emoji,
      })
      setMessages([])
      nextId.current = 0
      addMessage({
        role: 'buddy',
        text: data.opening.line,
        correction: data.opening.correction,
      })
      setStats(data.opening.stats)
      setPhase('chat')
    } catch (err) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  async function handleSend(text) {
    addMessage({ role: 'user', text })
    setWaiting(true)
    setError(null)
    try {
      const data = await sendMessage(session.id, text)
      addMessage({ role: 'buddy', text: data.line, correction: data.correction })
      setStats(data.stats)
    } catch (err) {
      setError(err.message)
      // The session is gone server-side, so there is nothing to send follow-ups to.
      if (err.status === 404) setPhase('setup')
    } finally {
      setWaiting(false)
    }
  }

  async function handleQuit() {
    if (!session) return
    try {
      const data = await endSession(session.id)
      setSummary(data)
      setPhase('summary')
    } catch {
      // Session already expired — just go back to the picker.
      setPhase('setup')
    }
    setSession(null)
  }

  function handleRestart() {
    setSummary(null)
    setMessages([])
    setStats(null)
    setPhase('setup')
  }

  return (
    <div className="app">
      <div className="shell">
        <TopBar
          stats={phase === 'chat' ? stats : null}
          onQuit={phase === 'chat' ? handleQuit : null}
        />

        {error && (
          <div className="banner" role="alert">
            <span>⚠️</span>
            {error}
          </div>
        )}

        {phase === 'loading' && <div className="slab" style={{ padding: 24 }}>Loading…</div>}

        {phase === 'setup' && config && (
          <SetupScreen config={config} starting={starting} onStart={handleStart} />
        )}

        {phase === 'chat' && session && (
          <ChatScreen
            session={session}
            messages={messages}
            waiting={waiting}
            onSend={handleSend}
            voiceEnabled={!!config?.voice_enabled}
          />
        )}

        {phase === 'summary' && summary && (
          <SummaryScreen summary={summary} onRestart={handleRestart} />
        )}
      </div>
    </div>
  )
}
