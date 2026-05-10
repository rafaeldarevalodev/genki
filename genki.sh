#!/bin/bash
# genki.sh - Unified manager for Genki Sensei
# Usage: ./genki.sh [start|stop|status|restart] [--dev]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Puertos
PIPER_PORT=8080
KOKORO_PORT=8880
VIBEVOICE7B_PORT=8091
VOICE_EVAL_PORT=10301
NEXT_PORT=9002

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

log() { echo -e "${GREEN}[genki]${NC} $1"; }
warn() { echo -e "${YELLOW}[genki]${NC} $1"; }
error() { echo -e "${RED}[genki]${NC} $1"; }
info() { echo -e "${BLUE}[genki]${NC} $1"; }

CONDA_INIT="$HOME/miniforge3/etc/profile.d/conda.sh"
[ -f "$CONDA_INIT" ] && source "$CONDA_INIT"

check_port() {
    lsof -i :$1 > /dev/null 2>&1
}

service_status() {
    local port=$1
    local name=$2
    if check_port $port; then
        echo -e "  ${GREEN}✓${NC} ${name} (localhost:$port)"
        return 0
    else
        echo -e "  ${RED}✗${NC} ${name} (localhost:$port)"
        return 1
    fi
}

cmd_status() {
    echo ""
    echo -e "${BOLD}=== Genki Status ===${NC}"
    echo ""
    
    local running=0
    local total=5
    
    service_status $PIPER_PORT "Piper TTS" || ((running++))
    service_status $KOKORO_PORT "Kokoro TTS" || ((running++))
    service_status $VIBEVOICE7B_PORT "VibeVoice 7B TTS" || ((running++))
    service_status $VOICE_EVAL_PORT "Voice Eval" || ((running++))
    service_status $NEXT_PORT "Next.js" || ((running++))
    
    echo ""
    echo -e "Running: $((total - running))/$total"
    echo ""
    echo "URLs:"
    if check_port $NEXT_PORT; then
        echo -e "  ${CYAN}http://localhost:$NEXT_PORT${NC} - App"
    fi
    if check_port $KOKORO_PORT; then
        echo -e "  ${CYAN}http://localhost:$KOKORO_PORT/health${NC} - Kokoro"
    fi
    if check_port $VIBEVOICE7B_PORT; then
        echo -e "  ${CYAN}http://localhost:$VIBEVOICE7B_PORT/health${NC} - VibeVoice 7B"
    fi
    echo ""
}

start_service() {
    local name=$1
    local port=$2
    local start_fn=$3
    
    if check_port $port; then
        warn "$name ya está corriendo en puerto $port"
        return 0
    fi
    
    info "Iniciando $name..."
    $start_fn
    
    sleep 2
    
    if check_port $port; then
        log "$name iniciado"
        return 0
    else
        error "Error iniciando $name. Revisa los logs."
        return 1
    fi
}

start_piper() {
    conda activate genki 2>/dev/null || { error "Entorno genki no existe"; return 1; }
    nohup python tts/server.py > /tmp/piper.log 2>&1 &
}

start_kokoro() {
    conda activate genki 2>/dev/null || { error "Entorno genki no existe"; return 1; }
    nohup python kokoro_server.py > /tmp/kokoro.log 2>&1 &
}

start_vibevoice7b() {
    conda activate vibevoice7b 2>/dev/null || { error "Entorno vibevoice7b no existe"; return 1; }
    nohup python vibevoice7b_server.py > /tmp/vibevoice7b.log 2>&1 &
}

start_voice_eval() {
    conda activate voice-eval-env 2>/dev/null || { error "Entorno voice-eval-env no existe"; return 1; }
    nohup python voice-eval/main_api.py --port $VOICE_EVAL_PORT --eval voxmlx > /tmp/voice_eval.log 2>&1 &
}

start_next() {
    nohup npm run dev > /tmp/nextjs.log 2>&1 &
}

cmd_start() {
    local dev_mode=$1
    
    log "Iniciando Genki Sensei..."
    echo ""
    
    local failed=0
    
    start_service "Piper TTS" $PIPER_PORT start_piper || ((failed++))
    start_service "Kokoro TTS" $KOKORO_PORT start_kokoro || ((failed++))
    start_service "VibeVoice 7B TTS" $VIBEVOICE7B_PORT start_vibevoice7b || ((failed++))
    start_service "Voice Eval" $VOICE_EVAL_PORT start_voice_eval || ((failed++))
    
    if [ "$dev_mode" = "dev" ]; then
        echo ""
        info "Modo desarrollo. Next.js NO se inicia automáticamente."
        warn "Para iniciar Next.js manualmente:"
        echo -e "  ${CYAN}npm run dev${NC}  # En otra terminal"
    else
        start_service "Next.js" $NEXT_PORT start_next || ((failed++))
    fi
    
    echo ""
    
    if [ $failed -eq 0 ]; then
        log "¡Todo listo!"
        echo ""
        echo -e "  Abre tu navegador: ${CYAN}http://localhost:$NEXT_PORT${NC}"
        echo ""
        echo "Comandos:"
        echo -e "  ${BOLD}./genki.sh stop${NC}      # Detener todos"
        echo -e "  ${BOLD}./genki.sh status${NC}    # Ver estado"
        echo ""
    else
        warn "$failed servicio(s) no pudieron iniciar"
        echo "Revisa los logs en /tmp/"
    fi
}

cmd_stop() {
    log "Deteniendo Genki Sensei..."
    echo ""
    
    for port in $NEXT_PORT $PIPER_PORT $KOKORO_PORT $VIBEVOICE7B_PORT $VOICE_EVAL_PORT; do
        PIDS=$(lsof -ti :$port 2>/dev/null) || continue
        if [ -n "$PIDS" ]; then
            echo "$PIDS" | xargs kill -9 2>/dev/null || true
            log "Detenido servicio en puerto $port"
        fi
    done
    
    echo ""
    log "Todos los servicios detenidos"
}

cmd_restart() {
    cmd_stop
    sleep 1
    cmd_start "$1"
}

usage() {
    echo ""
    echo -e "${BOLD}Genki Sensei - Manager${NC}"
    echo ""
    echo "Uso: ./genki.sh [comando] [opciones]"
    echo ""
    echo "Comandos:"
    echo -e "  ${GREEN}start${NC}   - Iniciar todos los servicios"
    echo -e "  ${GREEN}stop${NC}    - Detener todos los servicios"
    echo -e "  ${GREEN}restart${NC} - Reiniciar todos los servicios"
    echo -e "  ${GREEN}status${NC}  - Ver estado de los servicios"
    echo ""
    echo "Opciones:"
    echo -e "  ${GREEN}--dev${NC}    - No iniciar Next.js (para desarrollo)"
    echo ""
    echo "Ejemplos:"
    echo -e "  ${CYAN}./genki.sh start${NC}       # Iniciar todo"
    echo -e "  ${CYAN}./genki.sh start --dev${NC}  # Iniciar sin Next.js"
    echo -e "  ${CYAN}./genki.sh status${NC}       # Ver qué está corriendo"
    echo -e "  ${CYAN}./genki.sh stop${NC}         # Detener todo"
    echo ""
}

# Main
DEV_MODE=""
CMD="status"

for arg in "$@"; do
    case $arg in
        start|stop|status|restart)
            CMD=$arg
            ;;
        --dev|dev)
            DEV_MODE="dev"
            ;;
        -h|--help|help)
            usage
            exit 0
            ;;
    esac
done

case "$CMD" in
    start)
        cmd_start "$DEV_MODE"
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    restart)
        cmd_restart "$DEV_MODE"
        ;;
esac