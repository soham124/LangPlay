export default function SummaryScreen({ summary, onRestart }) {
  const { stats, corrections } = summary

  return (
    <div className="summary">
      <h1 className="summary__farewell">{summary.farewell}</h1>
      <p style={{ marginTop: 0, marginBottom: 24 }}>
        You practiced <strong>{summary.language}</strong> in “{summary.scenario_title}”.
      </p>

      <div className="summary__scores">
        <div className="score">
          <div className="score__value">{stats.turns}</div>
          <div className="score__label">Lines spoken</div>
        </div>
        <div className="score">
          <div className="score__value">{stats.corrections}</div>
          <div className="score__label">Grammar fixes</div>
        </div>
      </div>

      {corrections.length > 0 ? (
        <>
          <div className="field-label" style={{ marginBottom: 10 }}>
            Worth reviewing
          </div>
          <ul className="fix-list">
            {corrections.map((correction, index) => (
              <li key={index}>{correction}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="empty-note">
          ✅ No grammar corrections this session — clean run.
        </div>
      )}

      <button type="button" className="btn btn--blue btn--lg" onClick={onRestart}>
        ← New scene
      </button>
    </div>
  )
}
