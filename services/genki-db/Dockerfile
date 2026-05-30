# Genki 2.0 — genki-db
# SQLite database service for user profiles and learning progress
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Create data directory and init script location
RUN mkdir -p /var/lib/genki

# Copy initialization script
COPY init-db.sql /docker-entrypoint-initdb.d/

# Health check uses sqlite3 directly on mounted volume
# Entry point handled via docker-compose healthcheck

WORKDIR /var/lib/genki

# Default command - keep container running
CMD ["tail", "-f", "/dev/null"]