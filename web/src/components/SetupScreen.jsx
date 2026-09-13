import { useState } from 'react'

// Cards cycle through the palette so the grid reads as blocks of flat color.
const ACCENTS = [
  'var(--green)',
  'var(--blue)',
  'var(--yellow)',
  'var(--pink)',
  'var(--purple)',
  'var(--orange)',
]

const LEVEL_CLASS = {
  Beginner: 'chip--green',
  Intermediate: 'chip--yellow',
  Advanced: 'chip--red',
}

export default function SetupScreen({ config, starting, onStart }) {
  const [language, setLanguage] = useState('Spanish')
  const [scenarioId, setScenarioId] = useState('restaurant')
  const [customScenario, setCustomScenario] = useState('')
  const [place, setPlace] = useState('')

  const useCustom = scenarioId === 'custom'
  const preset = config.scenarios.find((s) => s.id === scenarioId)
  const ready = useCustom ? customScenario.trim().length > 3 : Boolean(preset)

  function handleStart() {
    if (!ready) return

    const base = useCustom ? customScenario.trim() : preset.scenario
    // A place makes the model's vocabulary and register noticeably more specific.
    const scenario = place.trim() ? `${base} in ${place.trim()}` : base

    onStart({
      language,
      scenario,
      scenarioTitle: useCustom ? 'Custom scene' : preset.title,
      emoji: useCustom ? '🎭' : preset.emoji,
    })
  }

  return (
    <>
      <div className="hero">
        <h1>
          Talk your way
          <br />
          to <span className="hero__underline">fluency.</span>
        </h1>
        <p>
          Pick a language and a scene. Your partner stays in character, corrects your grammar as
          you go, and never breaks the roleplay.
        </p>
      </div>

      <section className="section">
        <div className="section__head">
          <span className="section__num">1</span>
          <h2 className="section__title">Choose your language</h2>
        </div>
        <div className="lang-grid">
          {config.languages.map((item) => (
            <button
              key={item.name}
              type="button"
              className="lang-card"
              aria-pressed={language === item.name}
              onClick={() => setLanguage(item.name)}
            >
              <span className="lang-card__code">{item.code}</span>
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__num">2</span>
          <h2 className="section__title">Pick a scene</h2>
        </div>
        <div className="scenario-grid">
          {config.scenarios.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="scenario-card"
              style={{ '--accent': ACCENTS[index % ACCENTS.length] }}
              aria-pressed={scenarioId === item.id}
              onClick={() => setScenarioId(item.id)}
            >
              <span className={`chip ${LEVEL_CLASS[item.level] ?? ''} scenario-card__level`}>
                {item.level}
              </span>
              <span className="scenario-card__emoji">{item.emoji}</span>
              <span className="scenario-card__title">{item.title}</span>
              <p className="scenario-card__blurb">{item.blurb}</p>
            </button>
          ))}

          <button
            type="button"
            className="scenario-card"
            style={{ '--accent': 'var(--pink)' }}
            aria-pressed={useCustom}
            onClick={() => setScenarioId('custom')}
          >
            <span className="scenario-card__emoji">✍️</span>
            <span className="scenario-card__title">Write your own</span>
            <p className="scenario-card__blurb">Describe any character and situation you like.</p>
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__num">3</span>
          <h2 className="section__title">Set the details</h2>
        </div>
        <div className="custom-scenario">
          {useCustom && (
            <label className="field-label">
              Your scene
              <textarea
                className="textarea"
                style={{ marginTop: 8 }}
                placeholder="e.g. A grumpy librarian who insists your book is overdue"
                value={customScenario}
                onChange={(event) => setCustomScenario(event.target.value)}
                maxLength={400}
              />
            </label>
          )}

          <label className="field-label">
            Where is this happening? <span style={{ opacity: 0.6 }}>(optional)</span>
            <input
              className="input"
              style={{ marginTop: 8 }}
              placeholder="e.g. Madrid, Kyoto, a small village in Provence"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              maxLength={80}
            />
          </label>

          <div className="start-row">
            <button
              type="button"
              className="btn btn--green btn--lg"
              disabled={!ready || starting}
              onClick={handleStart}
            >
              {starting ? 'Setting the scene…' : 'Start roleplay →'}
            </button>
            <span className="start-hint">
              {useCustom && !ready
                ? 'Describe your scene to begin.'
                : `${language} · ${useCustom ? 'Custom scene' : preset?.title}`}
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
