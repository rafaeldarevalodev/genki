#!/bin/bash
# =============================================================================
# Genki Sensei - Piper TTS Setup Script
# =============================================================================
# Este script configura el entorno TTS para Genki Sensei
# Ejecutar desde la raíz del proyecto: ./scripts/setup-tts.sh
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TTS_DIR="$PROJECT_DIR/tts"

echo "============================================"
echo "Genki Sensei - Piper TTS Setup"
echo "============================================"

# Verificar que conda está instalado
if ! command -v conda &> /dev/null; then
    echo "❌ Error: Conda no está instalado"
    echo "Por favor instala Minconda o Anaconda desde https://www.anaconda.com/download"
    exit 1
fi

# Cargar funciones de conda
source "$(conda info --base)/etc/profile.d/conda.sh"

# Crear directorio TTS
mkdir -p "$TTS_DIR/models"
cd "$TTS_DIR"

echo "📦 Paso 1: Verificando entorno conda 'genki'..."
if conda env list | grep -q "^genki "; then
    echo "   ✓ Entorno 'genki' encontrado"
else
    echo "   Creando nuevo entorno 'genki'..."
    conda create -n genki python=3.11 -y
fi

echo "📥 Paso 2: Instalando piper-tts..."
conda activate genki

pip install piper-tts 2>/dev/null || {
    echo "   ✗ Error instalando piper-tts"
    exit 1
}

echo "   ✓ piper-tts instalado"

echo "📥 Paso 3: Verificando modelos de voz..."
MODEL_DIR="$TTS_DIR/models"

download_model() {
    local name=$1
    local url=$2
    local json_url=$3
    
    if [ -f "$MODEL_DIR/$name.onnx" ]; then
        echo "   ✓ $name ya existe"
        return 0
    fi
    
    echo "   📥 Descargando $name..."
    if curl -L -o "$MODEL_DIR/$name.onnx" "$url" 2>/dev/null; then
        [ -n "$json_url" ] && curl -L -o "$MODEL_DIR/$name.onnx.json" "$json_url" 2>/dev/null || true
        echo "   ✓ $name descargado"
    else
        echo "   ⚠️  Error al descargar $name (red o URL)"
        return 1
    fi
}

# Descargar modelos principales
# Inglés US
download_model "en_US-lessac-medium" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en_US/lessac/medium/en_US-lessac-medium.onnx" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en_US/lessac/medium/en_US-lessac-medium.onnx.json"

# Español MX
download_model "es_MX-claude-high" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/es_MX/claude/high/es_MX-claude-high.onnx" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/es_MX/claude/high/es_MX-claude-high.onnx.json"

# Japonés
download_model "ja_JP-lessac-medium" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/ja_JP/lessac/medium/ja_JP-lessac-medium.onnx" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/ja_JP/lessac/medium/ja_JP-lessac-medium.onnx.json"

echo ""
echo "============================================"
echo "✅ Instalación completada!"
echo "============================================"
echo ""
echo "Para iniciar el servidor TTS:"
echo "  bash scripts/start-tts.sh"
echo ""
echo "Modelos instalados:"
ls -la "$MODEL_DIR"/*.onnx 2>/dev/null || echo "   (ninguno - descarga manual requerida)"
echo ""
echo "============================================"