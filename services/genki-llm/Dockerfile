# Genki 2.0 — genki-llm
# Ollama server for local LLM inference on Apple Silicon
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    zstd \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Create model cache directory
RUN mkdir -p /root/.ollama

# Copy modelfile and startup script
COPY modelfile /root/.ollama/modelfile
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose Ollama API port
EXPOSE 11434

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:11434/api/tags || exit 1

# Start Ollama server and pull model
CMD ["/start.sh"]