#!/bin/bash
# =============================================================================
# Genki Sensei - Start TTS Server
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TTS_DIR="$PROJECT_DIR/tts"

cd "$TTS_DIR"

echo "🎤 Iniciando Genki TTS Server..."

# Cargar funciones de conda
if [ -f ~/miniforge3/etc/profile.d/conda.sh ]; then
    source ~/miniforge3/etc/profile.d/conda.sh
fi

# Verificar que el entorno conda existe
if ! conda env list | grep -q "^genki "; then
    echo "  ✗ Entorno 'genki' no encontrado"
    echo "  Ejecuta primero: bash scripts/setup-tts.sh"
    exit 1
fi
echo "  ✓ Entorno 'genki' encontrado"

# Verificar modelos
MODEL_COUNT=$(ls -1 "$TTS_DIR/models"/*.onnx 2>/dev/null | wc -l)
if [ "$MODEL_COUNT" -eq 0 ]; then
    echo "  ⚠️  No hay modelos en $TTS_DIR/models"
else
    echo "  ✓ Modelos encontrados: $MODEL_COUNT"
fi

# Activar entorno y iniciar servidor
echo ""
echo "Iniciando servidor..."
export PATH="$HOME/miniforge3/envs/genki/bin:$PATH"
cd "$TTS_DIR"

exec python server.py "$@"