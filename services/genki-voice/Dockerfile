# Genki 2.0 — genki-voice (Phase 5 placeholder)
# Voice service with ASR/TTS - implementation pending Phase 5
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Health check placeholder
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8092/health || exit 1

CMD ["tail", "-f", "/dev/null"]