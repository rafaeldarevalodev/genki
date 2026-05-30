#!/bin/bash
# Genki 2.0 — Initialize Qdrant collections for session memory

set -e

QDRANT_HOST="${QDRANT_HOST:-localhost}"
QDRANT_PORT="${QDRANT_PORT:-6333}"

echo "Waiting for Qdrant to be ready..."
until curl -sf "http://${QDRANT_HOST}:${QDRANT_PORT}/readyz" > /dev/null 2>&1; do
    echo "  Qdrant not ready, waiting..."
    sleep 2
done
echo "Qdrant is ready."

# Create sessions collection for semantic session memory
echo "Creating 'sessions' collection..."
curl -X PUT "http://${QDRANT_HOST}:${QDRANT_PORT}/collections/sessions" \
    -H "Content-Type: application/json" \
    -d '{
        "vectors": {
            "size": 1536,
            "distance": "Cosine"
        },
        "fields": {
            "session_id": "keyword",
            "user_id": "keyword",
            "timestamp": "datetime",
            "text_chunk": "text"
        }
    }' 2>/dev/null || echo "Collection may already exist or Qdrant version uses different schema"

echo "Collections initialized successfully."
echo "Sessions collection ready at http://${QDRANT_HOST}:${QDRANT_PORT}/collections/sessions"