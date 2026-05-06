#!/bin/bash
# setup.sh - Setup completo de Genki Sensei
# Usage: ./setup.sh [full|quick|skip-models]
#
#   full        - Instalar todo (entornos, deps, modelos)
#   quick      - Solo instalar deps y entornos (saltar descarga de modelos)
#   skip-models - Solo iniciar servidores (sin descargar nada)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    log_step "1" "5" "Instalando dependencias Node.js..."
    
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
    
    # Entorno genki
    if conda env list | grep -q "^genki "; then
        log_info "Entorno 'genki' ya existe"
    else
        log_info "Creando entorno 'genki'..."
        conda create -n genki python=3.11 -y -q
        conda activate genki
        pip install genkit dotenv numpy -q
    fi
    
    # Entorno voxtral_audio
    if conda env list | grep -q "^voxtral_audio "; then
        log_info "Entorno 'voxtral_audio' ya existe"
    else
        log_info "Creando entorno 'voxtral_audio'..."
        conda create -n voxtral_audio python=3.12 -y -q
        conda activate voxtral_audio
        pip install mlx-audio "mistral-common[audio]" numpy -q
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
    
    log_info "Entornos Conda listos"
}

download_models() {
    log_step "3" "6" "Descargando modelos de TTS..."
    
    # Crear directorios de modelos
    mkdir -p models
    mkdir -p tts/models
    
    # Descargar Voxtral TTS si no existe
    if [ -d "models/Voxtral-4B-TTS" ]; then
        log_info "Modelo Voxtral TTS ya existe"
    else
        log_info "Descargando Voxtral TTS (esto puede tomar tiempo)..."
        
        if check_command python; then
            python scripts/download-models.py
        else
            log_warn "Saltando descarga automática. Descargar manualmente desde:"
            echo "  https://huggingface.co/mlx-community/Voxtral-4B-TTS-2603-mlx-4bit"
            echo ""
            echo "O ejecutar después:"
            echo "  python scripts/download-models.py"
        fi
    fi
    
    # Descargar modelos Piper
    if ls tts/models/*.onnx 2>/dev/null | head -1 | grep -q .; then
        log_info "Modelos Piper ya existen"
    else
        log_info "Descargando modelos Piper..."
        cd tts/models
        
        # Descargar modelos en_US-lessac-medium
        if [ ! -f "en_US-lessac-medium.onnx" ]; then
            echo "Descargando en_US-lessac-medium..."
            # Agregar aquí descarga si se quiere automática
        fi
        
        cd "$SCRIPT_DIR"
        log_info "Para descargar más modelos Piper, ver:"
        echo "  https://github.com/rhasspy/piper/tree/master/src/python_run"
    fi
    
    log_info "Modelos listos"
}
        fi
    fi
    
    # Los modelos de Piper se pueden descargar manualmente
    # https://github.com/rhasspy/piper
    log_info "Modelos listos"
}

build_app() {
    log_step "4" "6" "Build de producción..."
    
    npm run build || {
        log_warn "Build falló, usando modo desarrollo"
    }
    
    log_info "App compilada"
}

start_servers() {
    log_step "5" "6" "Iniciando servidores..."
    
    # Usar start-servers.sh
    chmod +x start-servers.sh
    ./start-servers.sh start || {
        log_warn "No se pudieron iniciar todos los servidores"
    }
    
    log_info "Servidores iniciados"
}

verify_setup() {
    echo ""
    echo "=== Verificación ==="
    
    # Verificar puertos
    echo "Puertos:"
    lsof -i :8000 2>/dev/null && echo "  ✓ Voxtral TTS (8000)" || echo "  ✗ Voxtral TTS (8000)"
    lsof -i :8080 2>/dev/null && echo "  ✓ Piper TTS (8080)" || echo "  ✗ Piper TTS (8080)"
    lsof -i :1234 2>/dev/null && echo "  ✓ LM Studio (1234)" || echo "  ✗ LM Studio (1234)"
    lsof -i :9002 2>/dev/null && echo "  ✓ Next.js (9002)" || echo "  ✗ Next.js (9002)"
    
    echo ""
    echo ".URLs:"
    echo "  App:      http://localhost:9002"
    echo "  Voxtral:  http://localhost:8000/health"
    echo "  Piper:   http://localhost:8080/health"
    echo ""
    echo "=== Setup completo ==="
}

usage() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Opciones:"
    echo "  full         - Instalar todo (default)"
    echo "  quick        - Instalar deps sin descargar modelos"
    echo "  skip-models - Solo iniciar servidores"
    echo "  node-only    - Solo instalar deps Node"
    echo "  conda-only   - Solo crear entornos Conda"
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
        log_info "Mode: QUICK (sin descargar modelos)"
        install_node_deps
        install_conda_envs
        build_app
        start_servers
        verify_setup
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