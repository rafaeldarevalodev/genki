#!/bin/bash
# Wrapper script to start Voxtral TTS server with CPU mode
cd /Volumes/Rafa\ HD/Freelances/genki

# Force CPU mode
export MLX_STREAMING_DEVICE=cpu
export MLX_ENABLE_AUTO_MODE=0
export MLX_FACE_LOAD_ON_DEMAND=1

# Activate conda env and run server
eval "$(conda shell.bash hook)"
conda activate voxtral_audio
python audio_server.py