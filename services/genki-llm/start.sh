#!/bin/bash
# Genki 2.0 — genki-llm startup script
# Detects hardware (Metal/CUDA/CPU) and configures Ollama accordingly

set -e

export OLLAMA_HOST=0.0.0.0
export OLLAMA_MODELS=/root/.ollama

# ─── Hardware Detection ─────────────────────────────────────────────────────────

detect_hardware() {
    local hw_type="cpu"

    # Check for Apple Silicon / Metal
    if [ -f /sys/class/dmi/id/product_name ]; then
        local product_name
        product_name=$(cat /sys/class/dmi/id/product_name 2>/dev/null || echo "")
        if echo "$product_name" | grep -qi "mac\|macbook\|apple"; then
            # Running inside OrbStack/Linux VM on macOS — check for Metal availability
            if [ "$(uname -m)" = "aarch64" ] && [ -d "/dev/metal" ] 2>/dev/null; then
                hw_type="metal"
            elif [ "$(uname -s)" = "Darwin" ]; then
                hw_type="metal"
            fi
        fi
    fi

    # Check for NVIDIA GPU (CUDA)
    if [ "$hw_type" = "cpu" ] && command -v nvidia-smi >/dev/null 2>&1; then
        if nvidia-smi >/dev/null 2>&1; then
            hw_type="cuda"
        fi
    fi

    # Check for Metal device node (Apple Silicon direct passthrough)
    if [ "$hw_type" = "cpu" ] && [ -c "/dev/metal" ] 2>/dev/null; then
        hw_type="metal"
    fi

    echo "$hw_type"
}

# ─── Configure Ollama ──────────────────────────────────────────────────────────

HW_TYPE=$(detect_hardware)

echo "Detected hardware: $HW_TYPE"

case "$HW_TYPE" in
    metal)
        echo "Configuring for Apple Silicon Metal..."
        export OLLAMA_LLM_LIBRARY=metal
        export OLLAMA_FLASH_ATTENTION=1
        # Metal is auto-detected by Ollama on aarch64 macOS
        ;;
    cuda)
        echo "Configuring for NVIDIA CUDA..."
        export OLLAMA_LLM_LIBRARY=cuda
        export OLLAMA_FLASH_ATTENTION=1
        export CUDA_VISIBLE_DEVICES=0
        ;;
    *)
        echo "Configuring for CPU (no GPU detected)..."
        export OLLAMA_LLM_LIBRARY=cpu
        unset OLLAMA_FLASH_ATTENTION
        ;;
esac

echo "OLLAMA_LLM_LIBRARY=$OLLAMA_LLM_LIBRARY"

# ─── Start Ollama ─────────────────────────────────────────────────────────────

echo "Starting Ollama server..."
ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "Waiting for Ollama API to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "  Ollama API not ready, waiting..."
    sleep 2
done

echo "Ollama API is ready."

# Pull model
echo "Pulling mistral (placeholder)..."
ollama pull mistral || echo "Model pull completed or already exists"

echo "Genki LLM service ready on port 11434 (hw: $HW_TYPE)"

# Keep container alive
wait $OLLAMA_PID
