import os
import sys

from dotenv import load_dotenv
from google import genai
from google.genai import types

from langplay_prompt import (
    MODEL,
    TEMPERATURE,
    build_system_prompt,
    farewell_for,
)

# Replies (and the farewells for Japanese, Korean, Hindi) contain characters the
# legacy Windows console encoding cannot represent. Without this, printing them
# raises UnicodeEncodeError instead of showing the text.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

# 1. Initialize the client (reads GEMINI_API_KEY from your .env file)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 2. Choose the language and scene. The web UI picks these on screen instead;
#    see the setup screen in web/ if you would rather not edit code.
TARGET_LANGUAGE = "Spanish"
SCENARIO = "A waiter at a busy traditional restaurant in Madrid"

system_prompt = build_system_prompt(TARGET_LANGUAGE, SCENARIO)

print(f"🤖 Starting roleplay in {TARGET_LANGUAGE}! Type 'quit' to exit.\n")

# 3. Start a continuous chat session with the system instruction
chat = client.chats.create(
    model=MODEL,
    config=types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=TEMPERATURE,
    ),
)

# 4. Main conversation loop
while True:
    user_input = input("You: ")
    if user_input.lower() == "quit":
        print(f"{farewell_for(TARGET_LANGUAGE)} Thanks for practicing.")
        break

    # Send the user's message to the AI and print the response
    response = chat.send_message(user_input)
    print(f"\nBuddy: {response.text}\n")
