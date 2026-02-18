from gtts import gTTS
import pygame
import os
import uuid
import time

# Initialize pygame mixer once
pygame.mixer.init()

def speak(text, lang="en"):
    filename = f"temp_{uuid.uuid4()}.mp3"

    tts = gTTS(text=text, lang=lang)
    tts.save(filename)

    try:
        pygame.mixer.music.load(filename)
        pygame.mixer.music.set_volume(1.0)
        pygame.mixer.music.play()

        # wait until audio finishes
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)

    finally:
        pygame.mixer.music.stop()
        pygame.mixer.music.unload()

        if os.path.exists(filename):
            os.remove(filename)
