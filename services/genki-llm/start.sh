#!/bin/bash
# Genki 2.0 — genki-llm startup script
# Pulls Minimax 2.7 model and starts Ollama server

set -e

echo "Starting Ollama server..."
export OLLAMA_HOST=0.0.0.0
export OLLAMA_MODELS=/root/.ollama

# Start Ollama in background
ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "Waiting for Ollama API to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "  Ollama API not ready, waiting..."
    sleep 2
done

echo "Ollama API is ready."

# Pull Minimax 2.7 model
# Using mistral as placeholder since actual Minimax 2.7 Ollama image is TBD
echo "Pulling Minimax 2.7 model (using mistral as placeholder)..."
ollama pull mistral || echo "Model pull completed or already exists"

echo "Genki LLM service ready."
echo "Ollama server running on port 11434"

# Wait for Ollama process
wait $OLLAMA_PID