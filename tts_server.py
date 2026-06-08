from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from kokoro import KPipeline
import io
import soundfile as sf
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Detect device (prefer GPU/CUDA if available)
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"--- Starting Kokoro-82M server ---")
print(f"Targeting device: {device}")

# Initialize pipelines lazily to avoid crashing on start if there's a CUDA config issue
pipelines = {}

def get_pipeline(lang_code: str):
    if lang_code not in pipelines:
        try:
            print(f"Initializing Kokoro KPipeline for lang_code='{lang_code}' on {device}...")
            pipelines[lang_code] = KPipeline(lang_code=lang_code, device=device)
        except Exception as e:
            print(f"Failed to initialize on {device}, falling back to CPU: {e}")
            pipelines[lang_code] = KPipeline(lang_code=lang_code, device="cpu")
    return pipelines[lang_code]

class TTSRequest(BaseModel):
    text: str
    voiceId: str

# Define Kokoro Voices to map to the UI (American & British)
VOICES = [
    # US English Voices
    { "voice_id": "af_heart", "name": "Heart (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_alloy", "name": "Alloy (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_aoede", "name": "Aoede (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_bella", "name": "Bella (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_jessica", "name": "Jessica (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_kore", "name": "Kore (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_nicole", "name": "Nicole (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_nova", "name": "Nova (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_sarah", "name": "Sarah (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "af_sky", "name": "Sky (US Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "us" } },
    { "voice_id": "am_adam", "name": "Adam (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_echo", "name": "Echo (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_eric", "name": "Eric (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_fenrir", "name": "Fenrir (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_liam", "name": "Liam (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_michael", "name": "Michael (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_onyx", "name": "Onyx (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_pusheen", "name": "Pusheen (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    { "voice_id": "am_santa", "name": "Santa (US Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "us" } },
    # UK English Voices
    { "voice_id": "bf_alice", "name": "Alice (UK Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "uk" } },
    { "voice_id": "bf_bella", "name": "Bella (UK Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "uk" } },
    { "voice_id": "bf_emma", "name": "Emma (UK Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "uk" } },
    { "voice_id": "bf_isabella", "name": "Isabella (UK Female)", "category": "kokoro", "labels": { "gender": "female", "accent": "uk" } },
    { "voice_id": "bm_daniel", "name": "Daniel (UK Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "uk" } },
    { "voice_id": "bm_fable", "name": "Fable (UK Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "uk" } },
    { "voice_id": "bm_george", "name": "George (UK Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "uk" } },
    { "voice_id": "bm_lewis", "name": "Lewis (UK Male)", "category": "kokoro", "labels": { "gender": "male", "accent": "uk" } }
]

@app.get("/voices")
async def get_voices():
    return VOICES

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    voice_id = req.voiceId
    text = req.text
    
    # Check if voice_id is valid for Kokoro, fallback if it's a legacy ElevenLabs ID
    valid_voices = {v["voice_id"] for v in VOICES}
    if voice_id not in valid_voices:
        print(f"Warning: Requested voice '{voice_id}' is not a valid Kokoro voice. Falling back to 'af_bella'.")
        voice_id = "af_bella"
        
    # Determine lang_code based on voice prefix ('a' for US, 'b' for UK)
    lang_code = 'b' if voice_id.startswith('b') else 'a'
    
    pipeline = get_pipeline(lang_code)
    
    try:
        # Generate audio using Kokoro KPipeline
        print(f"Generating speech for text ({len(text)} chars) using voice '{voice_id}'...")
        generator = pipeline(text, voice=voice_id, speed=1.0, split_pattern=r'\n+')
        
        audio_chunks = []
        for _, _, audio in generator:
            if audio is not None:
                audio_chunks.append(audio)
                
        if not audio_chunks:
            raise HTTPException(status_code=500, detail="No audio chunks generated from Kokoro pipeline.")
            
        full_audio = np.concatenate(audio_chunks)
        
        # Save audio to a buffer in standard WAV format
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, 24000, format='WAV')
        buffer.seek(0)
        
        return StreamingResponse(buffer, media_type="audio/wav")
    except Exception as e:
        import traceback
        print(f"TTS Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting server on port 8880...")
    uvicorn.run(app, host="0.0.0.0", port=8880)
