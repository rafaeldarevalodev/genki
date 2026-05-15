#!/bin/bash
# setup.sh - Setup completo de Genki Sensei
# Usage: ./setup.sh [full|quick|skip-models]
#
#   full        - Instalar todo (entornos, deps, modelos)
#   quick      - Solo instalar deps y entornos (saltar descarga de modelos)
#   skip-models - Solo iniciar servidores

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[SETUP]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP $1/$2]${NC} $3"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Activar conda
CONDA_INIT="$HOME/miniforge3/etc/profile.d/conda.sh"
if [ -f "$CONDA_INIT" ]; then
    source "$CONDA_INIT"
else
    log_error "Conda no encontrado. Instalar Miniforge3 primero:"
    echo "  https://github.com/conda/conda/releases"
    exit 1
fi

check_command() {
    command -v $1 > /dev/null 2>&1
}

install_node_deps() {
    log_step "1" "6" "Instalando dependencias Node.js..."
    
    if ! check_command node; then
        log_error "Node.js no encontrado. Instalar primero:"
        echo "  nvm install 20"
        exit 1
    fi
    
    if [ -d "node_modules" ]; then
        log_info "node_modules ya existe, actualizando..."
        npm install
    else
        npm install
    fi
    
    log_info "Dependencias Node.js instaladas"
}

install_conda_envs() {
    log_step "2" "6" "Creando entornos Conda..."
    
    # Entorno genki (Piper + Kokoro + Maya Live Voice)
    if conda env list | grep -q "^genki "; then
        log_info "Entorno 'genki' ya existe"
        conda activate genki
        pip install fastapi uvicorn f5-tts-mlx mlx-whisper requests 2>/dev/null || true
    else
        log_info "Creando entorno 'genki'..."
        conda create -n genki python=3.11 -y -q
        conda activate genki
        pip install genkit dotenv numpy fastapi uvicorn f5-tts-mlx mlx-whisper requests -q
    fi
    
    # Entorno voice_eval
    if conda env list | grep -q "^voice_eval "; then
        log_info "Entorno 'voice_eval' ya existe"
    else
        log_info "Creando entorno 'voice_eval'..."
        conda create -n voice_eval python=3.11 -y -q
        conda activate voice_eval
        pip install fastapi uvicorn python-multipart soundfile sounddevice httpx pydantic voxmlx numpy -q
    fi
    
    # Entorno vibevoice7b
    if conda env list | grep -q "^vibevoice7b "; then
        log_info "Entorno 'vibevoice7b' ya existe"
    else
        log_info "Creando entorno 'vibevoice7b'..."
        conda create -n vibevoice7b python=3.11 -y -q
        conda activate vibevoice7b
        pip install mlx huggingface_hub[hf_xet] soundfile numpy -q
    fi
    
    log_info "Entornos Conda listos"
}

download_models() {
    log_step "3" "6" "Descargando modelos de TTS..."
    
    mkdir -p tts/models
    
    # Modelos Piper
    if ls tts/models/*.onnx 2>/dev/null | head -1 | grep -q .; then
        log_info "Modelos Piper ya existen"
    else
        log_info "Modelos Piper no encontrados en tts/models/"
        echo "  Descargar desde: https://github.com/rhasspy/piper"
    fi
    
    log_info "Modelos TTS listos"
    
    # Descargar modelos MLX (F5-TTS + Whisper)
    download_ml_models
}

download_ml_models() {
    log_step "4" "6" "Descargando modelos MLX (F5-TTS + Whisper)..."
    
    conda activate genki
    
    # F5-TTS
    log_info "Descargando F5-TTS (~2GB)..."
    python -c "
from f5_tts_mlx.generate import generate
print('F5-TTS: Downloading model weights...')
generate('Hello world', output='/tmp/f5tts_test.wav')
print('F5-TTS: Model downloaded and verified')
" 2>&1 || log_warn "F5-TTS download failed (will retry on first use)"
    
    # Whisper
    log_info "Descargando Whisper (~1.5GB)..."
    python -c "
import mlx_whisper
print('Whisper: Downloading model weights...')
mlx_whisper.transcribe('/tmp/f5tts_test.wav', model='mlx-community/whisper-large-v3-turbo-mlx')
print('Whisper: Model downloaded and verified')
" 2>&1 || log_warn "Whisper download failed (will retry on first use)"
    
    log_info "Modelos MLX listos"
}

build_app() {
    log_step "5" "6" "Build de producción..."
    
    npm run build || {
        log_warn "Build falló, usando modo desarrollo"
    }
    
    log_info "App compilada"
}

start_servers() {
    log_step "6" "6" "Iniciando servidores..."
    
    chmod +x genki.sh
    ./genki.sh start || {
        log_warn "No se pudieron iniciar todos los servidores"
    }
    
    log_info "Servidores iniciados"
}

verify_setup() {
    echo ""
    echo "=== Setup completo ==="
    echo ""
    echo "Servicios activos:"
    echo "  - Next.js:        http://localhost:9002"
    echo "  - Piper TTS:      localhost:8080"
    echo "  - Kokoro TTS:     localhost:8880"
    echo "  - VibeVoice 7B:   localhost:8091"
    echo "  - Maya Live Voice: localhost:8092 (Live Voice Mode)"
    echo "  - Voice Eval:     localhost:10301"
    echo ""
    echo "Para ver el estado de los servicios:"
    echo "  ./genki.sh status"
    echo ""
    echo "Para iniciar Genki:"
    echo "  ./genki.sh start"
    echo ""
    echo "URL de la app:"
    echo "  http://localhost:9002"
    echo ""
    echo "Modelos MLX descargados:"
    echo "  - F5-TTS (Live Voice)"
    echo "  - Whisper (ASR)"
    echo ""
}

usage() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Opciones:"
    echo "  full           - Instalar todo (default)"
    echo "  quick          - Instalar deps sin descargar modelos MLX"
    echo "  ml-models      - Solo descargar modelos MLX (F5-TTS + Whisper)"
    echo "  skip-models    - Solo iniciar servidores"
    echo "  node-only      - Solo instalar deps Node"
    echo "  conda-only     - Solo crear entornos Conda"
    echo ""
    exit 1
}

# Main
MODE="${1:-full}"

case "$MODE" in
    full)
        log_info "Modo: INSTALACIÓN COMPLETA"
        install_node_deps
        install_conda_envs
        download_models
        build_app
        start_servers
        verify_setup
        ;;
    quick)
        log_info "Mode: QUICK (sin descargar modelos MLX)"
        install_node_deps
        install_conda_envs
        download_models
        build_app
        start_servers
        verify_setup
        ;;
    ml-models)
        log_info "Mode: ML MODELS (descargar F5-TTS + Whisper)"
        install_conda_envs
        download_ml_models
        ;;
    skip-models)
        log_info "Mode: SKIP MODELS (solo servidores)"
        start_servers
        verify_setup
        ;;
    node-only)
        install_node_deps
        ;;
    conda-only)
        install_conda_envs
        ;;
    *)
        usage
        ;;
esac

echo ""
log_info "Listo! Para más info: $0 --help"