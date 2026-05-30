# Genki 2.0 — genki-api (Phase 6 placeholder)
# API Gateway - implementation pending Phase 6
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Health check placeholder
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

CMD ["tail", "-f", "/dev/null"]