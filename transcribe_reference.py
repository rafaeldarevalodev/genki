#!/usr/bin/env python3
"""Transcribe reference voice audio files using whisper-large-v3 for maximum accuracy.

Usage:
    python transcribe_reference.py                    # Transcribe all .wav files
    python transcribe_reference.py en_Mark_Eng.wav    # Transcribe specific file
"""
import sys
import os
from pathlib import Path

MODEL = "mlx-community/whisper-large-v3-mlx"

def transcribe_file(wav_path: str) -> str:
    import mlx_whisper
    result = mlx_whisper.transcribe(wav_path, path_or_hf_repo=MODEL)
    return result["text"].strip()

def main():
    voices_dir = Path(__file__).parent / "reference_voices"
    
    if len(sys.argv) > 1:
        files = [voices_dir / sys.argv[1]]
    else:
        files = sorted(voices_dir.glob("*.wav"))
    
    for wav_file in files:
        txt_file = wav_file.with_suffix(".txt")
        print(f"Transcribing: {wav_file.name}...")
        text = transcribe_file(str(wav_file))
        txt_file.write_text(text)
        print(f"  -> {txt_file.name}: {text[:80]}...")

if __name__ == "__main__":
    main()