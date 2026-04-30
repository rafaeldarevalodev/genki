#!/bin/bash
# Keep TTS server running automatically

PYTHON="/Users/rafael/miniforge3/envs/genki/bin/python"
TTS_DIR="/Volumes/Rafa HD/Freelances/genki/tts"
PORT=8080

echo "🔄 Iniciando monitor de TTS..."

while true; do
    # Check if TTS está corriendo
    if ! lsof -i :$PORT > /dev/null 2>&1; then
        echo "🟢 Iniciando servidor TTS..."
        cd "$TTS_DIR"
        nohup $PYTHON server.py -p $PORT > /tmp/tts.log 2>&1 &
        sleep 2
    else
        echo "✅ TTS corriendo"
    fi
    
    # Esperar 30 segundos antes de verificar de nuevo
    sleep 30
done