from flask import Flask, request, jsonify
from flask_cors import CORS # 1. Import CORS
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from deep_translator import GoogleTranslator

import pygame
import sqlite3
import threading
import time
from datetime import datetime

# Import your existing modules
from stt_engine import listen_and_transcribe
from tts_engine import speak

active_notifications = []

app = Flask(__name__)
CORS(app) # 2. Enable CORS

# Load Dataset & AI Model
df = pd.read_csv("diabetes_qa_combined.csv", encoding="latin1")

questions = df["question"].astype(str).tolist()
answers = df["answer"].astype(str).tolist()
embedder = SentenceTransformer("all-MiniLM-L6-v2")
question_embeddings = embedder.encode(questions, normalize_embeddings=True)

# --- NEW: DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect('reminders.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT,
            remind_time TEXT,
            status TEXT DEFAULT 'pending'
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# --- NEW: BACKGROUND SCHEDULER ---
def check_reminders():
    
    while True:
        now = datetime.now().strftime("%H:%M") # Get current HH:MM
        conn = sqlite3.connect('reminders.db')
        cursor = conn.cursor()
        
        # Find pending reminders for the current time
        cursor.execute("SELECT id, task FROM reminders WHERE remind_time = ? AND status = 'pending'", (now,))
        reminders = cursor.fetchall()

        for r_id, task in reminders:
            print(f"⏰ Reminder Triggered: {task}")
            
            # 1. VOICE ALERT (Wrapped in try/except to prevent crashes)
            try:
                speak(f"Reminder: {task}", lang="en")
            except Exception as e:
                print(f"Voice Error: {e}")

            # 2. UI NOTIFICATION (Add to the global list for React to find)
            active_notifications.append({"id": r_id, "task": task})
            
            # 3. DATABASE UPDATE (Mark as completed)
            cursor.execute("UPDATE reminders SET status = 'completed' WHERE id = ?", (r_id,))
        
        conn.commit()
        conn.close()
        time.sleep(60) # Check every minute

# Start the background thread
threading.Thread(target=check_reminders, daemon=True).start()

def get_best_answer(query_en):
    query_embedding = embedder.encode([query_en], normalize_embeddings=True)
    similarities = cosine_similarity(query_embedding, question_embeddings)[0]
    best_index = similarities.argmax()
    if similarities[best_index] < 0.60:
        return "I am not fully sure about this. Please maintain a healthy diet and consult a doctor."
    return answers[best_index]

@app.route('/process_voice', methods=['POST'])
def process_voice():
    # Get language from React frontend
    data = request.json
    lang = data.get('lang', 'en')
    
    # Step 1: Listen (STT)
    user_text, _ = listen_and_transcribe(lang)
    
    if not user_text:
        return jsonify({"error": "Voice not clear"}), 400

    # Step 2: Logic Flow
    if lang == "te":
        search_text = GoogleTranslator(source="te", target="en").translate(user_text)
        ans_en = get_best_answer(search_text)
        final_ans = GoogleTranslator(source="en", target="te").translate(ans_en)
    else:
        final_ans = get_best_answer(user_text)

    # Step 3: Speak (TTS) - Plays on the system
    speak(final_ans, lang)

    # Return data to React to update the Chat UI
    return jsonify({
        "user_text": user_text,
        "assistant_response": final_ans
    })
@app.route('/replay_audio', methods=['POST'])
def replay_audio():
    data = request.json
    text = data.get('text')
    lang = data.get('lang', 'en')

    if not text:
        return jsonify({"error": "No text provided"}), 400

    # Call the existing speak function
    speak(text, lang)
    
    return jsonify({"status": "success", "message": "Replaying audio..."})

# --- NEW: API ENDPOINT TO SET REMINDER ---
@app.route('/set_reminder', methods=['POST'])
def set_reminder():
    data = request.json
    task = data.get('task')
    remind_time = data.get('time') # Expected format "14:30"

    conn = sqlite3.connect('reminders.db')
    cursor = conn.cursor()
    cursor.execute("INSERT INTO reminders (task, remind_time) VALUES (?, ?)", (task, remind_time))
    conn.commit()
    conn.close()

    return jsonify({"status": "success", "message": f"Reminder set for {remind_time}"})

@app.route('/get_notifications', methods=['GET'])
def get_notifications():
    global active_notifications
    # Send the notifications and then clear the list
    response = jsonify(active_notifications)
    active_notifications = [] 
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000)