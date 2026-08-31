#!/usr/bin/env bash
set -euo pipefail

failed=0

check_health() {
    local name=$1
    local url=$2

    if curl --fail --silent --show-error --connect-timeout 2 --max-time 5 "$url" >/dev/null; then
        printf 'Healthy: %s (%s)\n' "$name" "$url"
    else
        printf 'Retained service unavailable: %s (%s)\n' "$name" "$url" >&2
        failed=1
    fi
}

check_retired_port() {
    local port=$1

    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        printf 'Retired service listener detected on port %s\n' "$port" >&2
        failed=1
    else
        printf 'No listener: retired port %s\n' "$port"
    fi
}

check_health 'Kokoro' 'http://localhost:8880/health'
check_health 'Maya' 'http://localhost:8092/health'
check_health 'F5-TTS' 'http://localhost:8093/health'
check_health 'Next.js' 'http://localhost:9002'
check_retired_port 8080
check_retired_port 8091

exit "$failed"
