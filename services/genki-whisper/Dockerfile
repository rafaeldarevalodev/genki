# Genki 2.0 — Whisper ASR Server (faster-whisper)
# Serves ASR via HTTP API. Port 8001.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    faster-whisper \
    uvicorn[standard]==0.32.0 \
    httpx

COPY whisper_server.py /app/

EXPOSE 8001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "whisper_server:app", "--host", "0.0.0.0", "--port", "8001"]
