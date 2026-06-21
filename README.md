# LangPlay: AI Roleplay Language Learning Buddy

LangPlay is a Python-based interactive terminal application designed to help users practice foreign languages through immersive, real-time roleplay scenarios. It leverages the official **Google GenAI SDK** powered by the **Gemini 2.5 Flash** model to simulate authentic conversations and provide constructive grammatical corrections dynamically.

---

## Features

- 🎭 **Scenario-Based Roleplay:** Simulates real-world interactions (e.g., ordering food in Spanish from a busy waiter in Madrid).
- 🎯 **Targeted Grammar Correction:** Automatically detects grammatical errors in your responses and provides gentle corrections formatted as `[correction]` before continuing in-character.
- 🗣️ **Immersive Practice:** Configured to respond strictly in the target language to maximize learning.
- ⚡ **Powered by Gemini 2.5 Flash:** Fast, context-aware responses using the latest Google Gemini API client.

---

## File Structure

```
LangPlay/
├── roleplay_buddy.py      # Main interactive CLI roleplay script
├── requirements.txt       # Project dependencies
└── .env                   # Environment file for API Keys (User-created)
```

---

## Prerequisites

- **Python 3.10 or higher**
- A **Gemini API Key** (You can obtain one from [Google AI Studio](https://aistudio.google.com/))

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
```
> **Note:** Make sure you do not commit your `.env` file to version control systems like GitHub to keep your API key secure.

---

## How to Run

Launch the application using Python:
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

You can easily modify the target language or the roleplay scenario by editing the parameters inside `roleplay_buddy.py`:

```python
# Open roleplay_buddy.py and change these lines:
TARGET_LANGUAGE = "Spanish"
SCENARIO = "A waiter at a busy traditional restaurant in Madrid"
```
