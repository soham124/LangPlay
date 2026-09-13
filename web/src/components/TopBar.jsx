function plural(count, word, suffix = 's') {
  return `${count} ${word}${count === 1 ? '' : suffix}`
}

export default function TopBar({ stats, onQuit }) {
  return (
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark__dot" />
        LANGPLAY
      </div>

      <div className="stat-row">
        {stats && (
          <>
            <span className="chip chip--blue">💬 {plural(stats.turns, 'turn')}</span>
            <span className="chip chip--yellow">✏️ {plural(stats.corrections, 'fix', 'es')}</span>
          </>
        )}
        {onQuit && (
          <button type="button" className="btn btn--ghost" onClick={onQuit}>
            End session
          </button>
        )}
      </div>
    </header>
  )
}
