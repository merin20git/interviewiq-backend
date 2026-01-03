import sys
import json
import time
import os
import tempfile
import subprocess
from faster_whisper import WhisperModel

try:
    # Arguments from Node.js
    audio_path = sys.argv[1]
    question = sys.argv[2]
    
    # Debug logging
    print(f"🐍 Python script started", file=sys.stderr)
    print(f"🐍 Audio path: {audio_path}", file=sys.stderr)
    print(f"🐍 Question length: {len(question)}", file=sys.stderr)
    print(f"🐍 Audio file exists: {os.path.exists(audio_path)}", file=sys.stderr)

    # If the input is a webm/ogg/m4a/mp3 file, convert to wav (16k mono) using ffmpeg for best compatibility
    input_ext = os.path.splitext(audio_path)[1].lower()
    temp_wav_path = None
    if input_ext in [".webm", ".ogg", ".m4a", ".mp3", ".opus"]:
        try:
            fd, temp_wav_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            # ffmpeg -y -i input -ac 1 -ar 16000 output.wav
            subprocess.run([
                "ffmpeg", "-y", "-i", audio_path, "-ac", "1", "-ar", "16000", temp_wav_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            audio_path = temp_wav_path
        except FileNotFoundError:
            # ffmpeg not installed or not in PATH
            raise RuntimeError("FFmpeg not found. Please install FFmpeg and ensure it is in your PATH.")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"FFmpeg failed to convert audio: {e}")

    # 1️⃣ Transcribe with Whisper (using tiny model with improved settings)
    print(f"🐍 Starting Whisper transcription", file=sys.stderr)
    start_time = time.time()
    model = WhisperModel("tiny", device="cpu", compute_type="int8")  # Fast, improved accuracy with better beam search
    print(f"🐍 Whisper model loaded", file=sys.stderr)
    # Improved transcription settings: beam_size=5 for better accuracy, language hint for English
    segments, info = model.transcribe(
        audio_path, 
        beam_size=5,  # Increased from 1 for better accuracy
        best_of=5,    # Increased from 1 for better accuracy 
        language="en",  # Hint that it's English
        temperature=0.0,  # Deterministic output
        vad_filter=True,  # Voice activity detection to filter silence
        condition_on_previous_text=False  # Each segment independent
    )
    transcript = " ".join([segment.text for segment in segments]).strip()
    print(f"🐍 Transcription completed: {len(transcript)} characters", file=sys.stderr)
    
    transcription_time = time.time() - start_time
    
    # Basic feedback using simple heuristics
    feedback = "Good response! Keep practicing to improve your interview skills."
    
    # Simple feedback based on transcript length
    word_count = len(transcript.split())
    if word_count < 10:
        feedback = "Try to provide more detailed answers with specific examples."
    elif word_count > 100:
        feedback = "Good detailed response! Try to be more concise while keeping key points."
    elif transcript.lower().find("experience") != -1 or transcript.lower().find("project") != -1:
        feedback = "Great job mentioning specific experience! This adds credibility to your answer."
    
    # Return JSON
    output = {
        "transcript": transcript,
        "feedback": feedback,
        "processing_time": round(transcription_time, 2),
        "word_count": word_count
    }
    print(json.dumps(output))

    # Cleanup temporary wav if created
    if temp_wav_path and os.path.exists(temp_wav_path):
        try:
            os.remove(temp_wav_path)
        except Exception:
            pass

except Exception as e:
    # Error handling with more specific error messages
    error_msg = str(e)
    if "No module named" in error_msg:
        error_msg = f"Missing dependency: {error_msg}"
    elif "FFmpeg" in error_msg:
        error_msg = "FFmpeg not found. Please install FFmpeg."
    elif "No such file" in error_msg:
        error_msg = "Audio file not found or corrupted."
    elif "timeout" in error_msg.lower():
        error_msg = "Processing timeout. Try a shorter recording."
    else:
        error_msg = f"Audio processing error: {error_msg}"
    
    error_output = {
        "transcript": "",
        "feedback": "Error processing audio. Please try again.",
        "error": error_msg,
        "processing_time": 0,
        "word_count": 0
    }
    print(json.dumps(error_output))
    # Exit with non-zero so the Node layer treats it as a processing failure
    sys.exit(1)
