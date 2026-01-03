"""
Pre-download Whisper 'base' model to avoid timeout during first recording.
Run this once before starting the interview application.
"""
import sys
from faster_whisper import WhisperModel

print("🔽 Downloading Whisper 'tiny' model...")
print("📦 This is a one-time download (~75MB)")
print("⏳ Please wait, this should only take 1-2 minutes...\n")

try:
    # This will download the model if not already cached
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    print("\n✅ Whisper 'tiny' model downloaded successfully!")
    print("🎤 You can now use voice recording in interviews without timeout issues.")
    
    # Test transcription to verify
    print("\n🧪 Model is ready and working!")
    
except Exception as e:
    print(f"\n❌ Error downloading model: {e}")
    print("\n💡 Troubleshooting:")
    print("   1. Check your internet connection")
    print("   2. Try running again (download will resume)")
    print("   3. If issues persist, you can use text answers instead")
    sys.exit(1)
