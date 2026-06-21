import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# 1. Initialize the client (Replace 'YOUR_API_KEY' with your actual key)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 2. Define the prompt that shapes the AI's personality
TARGET_LANGUAGE = "Spanish"
SCENARIO = "A waiter at a busy traditional restaurant in Madrid"

system_prompt = f"""
You are an AI language learning assistant. Your job is to roleplay with the user.
Persona: You are {SCENARIO}.
Language: You must speak ONLY in {TARGET_LANGUAGE}. 
Rules:
1. Keep your responses short and realistic for the scenario (1-3 sentences).
2. If the user makes a grammatical mistake in {TARGET_LANGUAGE}, gently correct it inside brackets [like this] at the start of your reply, then continue the roleplay in character.
3. Keep the conversation moving by asking a relevant question.
"""

print(f"🤖 Starting roleplay in {TARGET_LANGUAGE}! Type 'quit' to exit.\n")

# 3. Start a continuous chat session with the system instruction
chat = client.chats.create(
    model="gemini-2.5-flash",
    config=types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7
    )
)

# 4. Main conversation loop
while True:
    user_input = input("You: ")
    if user_input.lower() == 'quit':
        print("Adios! Thanks for practicing.")
        break
        
    # Send the user's message to the AI and print the response
    response = chat.send_message(user_input)
    print(f"\nBuddy: {response.text}\n")
