# Genki 2.0 — genki-voice (Phase 5)
# Voice service with ASR/TTS streaming pipeline
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY app/proto/ ./app/proto/

# Create directories for model cache and IPC
RUN mkdir -p /model_cache /tmp/genki/ipc

# Expose ports: 8092 (HTTP), 8091 (gRPC fallback)
EXPOSE 8092

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8092/health || exit 1

# Run the voice service
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8092"]
