#!/bin/bash
# start-servers.sh - Inicia todos los servidores de Genki Sensei
# Usage: ./start-servers.sh [start|stop|restart|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Puertos
VOXTRAL_PORT=8000
PIPER_PORT=8080
LMSTUDIO_PORT=1234
NEXT_PORT=9002

# Activar conda
CONDA_INIT="$HOME/miniforge3/etc/profile.d/conda.sh"
if [ -f "$CONDA_INIT" ]; then
    source "$CONDA_INIT"
fi

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_port() {
    lsof -i :$1 > /dev/null 2>&1
}

start_voxtral() {
    if check_port $VOXTRAL_PORT; then
        log_warn "Voxtral TTS ya corre en puerto $VOXTRAL_PORT"
        return
    fi
    
    log_info "Iniciando Voxtral TTS (puerto $VOXTRAL_PORT)..."
    
    cd "$PROJECT_DIR"
    
    conda activate voxtral_audio 2>/dev/null || {
        log_error "Entorno voxtral_audio no existe. Crear con:"
        echo "  conda env create -f environment.yml"
        exit 1
    }
    
    nohup python audio_server.py > /tmp/voxtral.log 2>&1 &
    VOXTRAL_PID=$!
    
    sleep 3
    
    if check_port $VOXTRAL_PORT; then
        log_info "Voxtral TTS iniciado (PID: $VOXTRAL_PID)"
    else
        log_error "Error iniciando Voxtral. Ver /tmp/voxtral.log"
    fi
}

start_piper() {
    if check_port $PIPER_PORT; then
        log_warn "Piper TTS ya corre en puerto $PIPER_PORT"
        return
    fi
    
    log_info "Iniciando Piper TTS (puerto $PIPER_PORT)..."
    
    cd "$PROJECT_DIR/tts"
    
    conda activate genki 2>/dev/null || {
        log_error "Entorno genki no existe"
        exit 1
    }
    
    nohup python server.py > /tmp/piper.log 2>&1 &
    PIPER_PID=$!
    
    sleep 2
    
    if check_port $PIPER_PORT; then
        log_info "Piper TTS iniciado (PID: $PIPER_PID)"
    else
        log_error "Error iniciando Piper. Ver /tmp/piper.log"
    fi
}

start_next() {
    if check_port $NEXT_PORT; then
        log_warn "Next.js ya corre en puerto $NEXT_PORT"
        return
    fi
    
    log_info "Iniciando Next.js (puerto $NEXT_PORT)..."
    
    cd "$PROJECT_DIR"
    
    nohup npm run dev > /tmp/nextjs.log 2>&1 &
    NEXT_PID=$!
    
    sleep 5
    
    if check_port $NEXT_PORT; then
        log_info "Next.js iniciado (PID: $NEXT_PID)"
    else
        log_error "Error iniciando Next.js. Ver /tmp/nextjs.log"
    fi
}

stop_all() {
    log_info "Deteniendo servidores..."
    
    # Matar procesos por puerto
    for port in $VOXTRAL_PORT $PIPER_PORT $NEXT_PORT; do
        PIDS=$(lsof -ti :$port 2>/dev/null) || continue
        if [ -n "$PIDS" ]; then
            echo "$PIDS" | xargs kill -9 2>/dev/null || true
            log_info "Proceso en puerto $port detenido"
        fi
    done
}

status_all() {
    echo "=== Estado de Servicios ==="
    echo ""
    
    for port in $VOXTRAL_PORT $PIPER_PORT $LMSTUDIO_PORT $NEXT_PORT; do
        if check_port $port; then
            echo -e "${GREEN}✓${NC} Puerto $port: ACTIVO"
        else
            echo -e "${RED}✗${NC} Puerto $port: inactivo"
        fi
    done
}

usage() {
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "  start    - Iniciar todos los servidores"
    echo "  stop     - Detener todos los servidores"
    echo "  restart  - Reiniciar todos los servidores"
    echo "  status   - Ver estado de puertos"
    exit 1
}

# Main
case "${1:-start}" in
    start)
        log_info "Iniciando servidores Genki Sensei..."
        start_voxtral
        start_piper
        # start_next  # Descomenta si quieres iniciar Next.js también
        echo ""
        status_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 1
        $0 start
        ;;
    status)
        status_all
        ;;
    *)
        usage
        ;;
esac