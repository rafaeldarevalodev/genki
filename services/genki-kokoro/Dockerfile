# Genki 2.0 — Kokoro TTS Server
# Serves TTS via HTTP. Port 5001.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    kokoro-onnx \
    soundfile \
    uvicorn[standard]==0.32.0 \
    httpx \
    pydantic

COPY kokoro_server.py /app/
COPY voices /app/voices 2>/dev/null || true

EXPOSE 5001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

CMD ["uvicorn", "kokoro_server:app", "--host", "0.0.0.0", "--port", "5001"]
