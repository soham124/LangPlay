# LangPlay: AI Roleplay Language Learning Buddy

LangPlay helps you practice foreign languages through immersive, real-time roleplay scenarios. It leverages the official **Google GenAI SDK** powered by the **Gemini 2.5 Flash** model to simulate authentic conversations and provide constructive grammatical corrections dynamically.

It ships in two forms:

- **Web app** — a Neo-Brutalist React UI where you pick your language and scene on screen.
- **CLI** — the original single-file terminal script.

---

## Features

- 🎭 **Scenario-Based Roleplay:** Simulates real-world interactions (e.g., ordering food in Spanish from a busy waiter in Madrid).
- 🎯 **Targeted Grammar Correction:** Automatically detects grammatical errors in your responses and provides gentle corrections formatted as `[correction]` before continuing in-character. In the web UI these are lifted out of the reply into their own callout cards.
- 🗣️ **Immersive Practice:** Configured to respond strictly in the target language to maximize learning.
- 🃏 **Scene Picker:** Eight preset scenarios across three difficulty levels, plus a free-text option to write your own character and situation.
- 📊 **Session Summary:** Ends each session with your line count and a reviewable list of every correction you collected.
- 🔊 **Listen Along (web):** Hear any reply read aloud at 0.7× speed, with each word highlighted in time with the voice — so you can hear where one word ends and the next begins.
- 🎤 **Speak Your Reply (web):** Answer out loud and have it transcribed into the language you are practising. The transcript lands in the input box so you can fix it before sending.
- ⚡ **Powered by Gemini Flash:** Fast, context-aware responses using the latest Google Gemini API client.

---

## File Structure

```
LangPlay/
├── roleplay_buddy.py      # Interactive CLI roleplay script
├── langplay_prompt.py     # Shared personas, languages, and scenario presets
├── api/
│   ├── main.py            # FastAPI backend for the web UI
│   └── voice.py           # ElevenLabs speech synthesis + recognition
├── web/                   # React + Vite frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js     # Dev server + /api proxy to the backend
│   └── src/
│       ├── App.jsx        # Screen flow: setup → chat → summary
│       ├── api.js         # Fetch wrappers for the backend
│       ├── voice.js       # Playback + word sync, and mic recording hooks
│       ├── styles.css     # Neo-Brutalist design system
│       └── components/
│           ├── TopBar.jsx
│           ├── SetupScreen.jsx
│           ├── ChatScreen.jsx
│           └── SummaryScreen.jsx
├── requirements.txt       # Python dependencies
└── .env                   # Environment file for API Keys (User-created)
```

Both entry points read their personas from `langplay_prompt.py`, so the prompt
never drifts between the CLI and the web app.

---

## Prerequisites

- **Python 3.10 or higher**
- **Node.js 18 or higher** (only needed for the web UI)
- A **Gemini API Key** (You can obtain one from [Google AI Studio](https://aistudio.google.com/))
- *Optional:* an **ElevenLabs API Key** (from [elevenlabs.io](https://elevenlabs.io/)) to turn on the voice features

---

## Installation & Setup

### 1. Clone or Open the Directory
Navigate to your project directory in PowerShell or CMD:
```powershell
cd c:\Desktop\Codes\Projects\LangPlay
```

### 2. Create and Activate a Virtual Environment
It is highly recommended to use a virtual environment to isolate project dependencies:

```powershell
# Create the virtual environment
python -m venv venv

# Activate it in PowerShell
.\venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
Install the required packages using pip:
```powershell
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a file named `.env` in the root of the project:
```env
GEMINI_API_KEY=your_actual_api_key_here

# Optional — enables Listen and the microphone in the web UI.
# ELEVEN_LABS_API_KEY works too, if you prefer that spelling.
ELEVENLABS_API_KEY=your_elevenlabs_key_here
# Optional — pick a specific voice. Without it, a stock voice is chosen for you.
ELEVENLABS_VOICE_ID=
```
> **Note:** Make sure you do not commit your `.env` file to version control systems like GitHub to keep your API key secure.

Two things to know about the ElevenLabs key, because both fail in confusing ways:

- Copy the **key**, not the key ID. Real keys start with `sk_` and are shown
  **only once**, when you create them. The 64-character hex string listed in the
  dashboard afterwards is the key's ID and will be rejected.
- Speaking replies aloud needs either a **paid plan** or a voice of your own.
  Free accounts cannot use ElevenLabs' library voices through the API, and keys
  without the `voices_read` permission cannot auto-pick one — set
  `ELEVENLABS_VOICE_ID` to a voice from your own VoiceLab in that case.
  Speech-to-text (the microphone) works on the free tier.

Without `ELEVENLABS_API_KEY` everything else still works — the app simply hides
the Listen and microphone buttons rather than offering controls that cannot run.

### 5. Install Frontend Dependencies
Only needed if you want the web UI:
```powershell
cd web
npm install
cd ..
```

---

## How to Run the Web App

The web app is two processes: the FastAPI backend and the Vite dev server. Run
each in its own terminal.

**Terminal 1 — backend (port 8000):**
```powershell
.\venv\Scripts\Activate.ps1
python -m uvicorn api.main:app --reload --port 8000
```

**Terminal 2 — frontend (port 5173):**
```powershell
cd web
npm run dev
```

Then open **http://localhost:5173**. Vite proxies `/api` calls through to the
backend, so you only ever visit the one URL.

Pick a language, pick a scene, and start talking. Your partner opens the scene
in character; your grammar corrections appear as yellow **FIX** cards above each
reply. Hit **End session** for a summary of everything worth reviewing.

> Sessions live in the backend's memory, so restarting the API server clears any
> conversation in progress.

### Using Your Voice

With `ELEVENLABS_API_KEY` set, two extra controls appear:

- **▶ Listen** above each reply reads that line aloud at 0.7× — the slowest
  ElevenLabs allows — and highlights each word in yellow as it is spoken. Press
  **■ Stop** to cut it short. Only one line plays at a time.
- **🎤** in the composer records your reply and transcribes it into the language
  you are practising. Press it again to stop, or **Cancel** to throw the clip
  away. The text lands in the input box rather than sending straight off, so you
  can correct it first.

Speech settings live in `langplay_prompt.py`: `TTS_SPEED` (0.7–1.2, where lower
is slower), `TTS_MODEL`, `STT_MODEL`, and `TTS_VOICE_PREFERENCES` — the stock
voice names tried in order when `ELEVENLABS_VOICE_ID` is unset. Voices are
resolved by name at runtime rather than by hardcoded ID, because ElevenLabs
retires premade voices and silently remaps their old IDs to different ones.

---

## How to Run the CLI

Launch the terminal version using Python:
```powershell
python roleplay_buddy.py
```

### Example Usage

```text
🤖 Starting roleplay in Spanish! Type 'quit' to exit.

You: Hola, quiero un mesa por favor.

Buddy: [Hola, quiero una mesa, por favor.] ¡Buenas tardes! Por supuesto, pase por aquí. ¿Prefiere una mesa en la terraza o adentro con el aire acondicionado?

You: Terraza por favor.

Buddy: ¡Excelente elección! La tarde está hermosa. Aquí tiene el menú. ¿Le gustaría empezar con algo de tomar, como una sangría fresca o una caña bien fría?
```

Type `quit` at any time to exit the program.

---

## Customizing Scenarios

**In the web app**, choose the language and scene on the setup screen — including
a *Write your own* card for any character you can describe. No code changes
needed.

**In the CLI**, edit the parameters inside `roleplay_buddy.py`:

```python
# Open roleplay_buddy.py and change these lines:
TARGET_LANGUAGE = "Spanish"
SCENARIO = "A waiter at a busy traditional restaurant in Madrid"
```

**To add a new preset** to the web app's picker, append an entry to `SCENARIOS`
in `langplay_prompt.py`:

```python
{
    "id": "barber",
    "emoji": "💈",
    "title": "The Barber Chair",
    "blurb": "Explain the haircut you actually want.",
    "scenario": "A confident barber who has strong opinions about your hair",
    "level": "Intermediate",
}
```

New languages go in the `LANGUAGES` list in the same file. `code` is drawn as a
lettered badge rather than a flag emoji on purpose — Windows ships no
country-flag glyphs, so flags there degrade to bare letter pairs.

---

## Design Notes

The UI is deliberately Neo-Brutalist, and `web/src/styles.css` commits to four
rules that keep it coherent:

- Every surface carries a hard **3px ink border** — no borderless cards.
- Shadows are **solid ink offsets**, never blurred.
- Colors are **flat and saturated** — no gradients anywhere.
- Interactive elements **physically move** when pressed, travelling into their
  own shadow.

Colors, border widths, and shadow offsets are CSS custom properties on `:root`,
so retheming means editing that one block. The palette borrows Duolingo's
greens, blues, and yellows for familiarity while keeping the harder brutalist
structure.
