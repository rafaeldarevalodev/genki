#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script="$project_root/tests/verify_retained_voice_stack_health.sh"

if [[ ! -x "$script" ]]; then
    printf 'Missing executable verification script: %s\n' "$script" >&2
    exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

cat > "$tmpdir/curl" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *":8880/health"*|*":8092/health"*|*":8093/health"*|*":9002"*) exit 0 ;;
  *) exit 22 ;;
esac
EOF

cat > "$tmpdir/lsof" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *":8080"*|*":8091"*) exit 1 ;;
  *) exit 1 ;;
esac
EOF

chmod +x "$tmpdir/curl" "$tmpdir/lsof"

PATH="$tmpdir:$PATH" "$script"

cat > "$tmpdir/curl" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *":8092/health"*) exit 22 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$tmpdir/curl"

if PATH="$tmpdir:$PATH" "$script" >"$tmpdir/unavailable.out" 2>&1; then
    printf 'Verification unexpectedly passed when Maya health was unavailable\n' >&2
    exit 1
fi
grep -q 'Retained service unavailable: Maya' "$tmpdir/unavailable.out"

cat > "$tmpdir/curl" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *":8093/health"*) exit 22 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$tmpdir/curl"

if PATH="$tmpdir:$PATH" "$script" >"$tmpdir/f5tts-unavailable.out" 2>&1; then
    printf 'Verification unexpectedly passed when F5-TTS health was unavailable\n' >&2
    exit 1
fi
grep -q 'Retained service unavailable: F5-TTS' "$tmpdir/f5tts-unavailable.out"

cat > "$tmpdir/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat > "$tmpdir/lsof" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *":8080"*) printf '12345\n'; exit 0 ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$tmpdir/curl" "$tmpdir/lsof"

if PATH="$tmpdir:$PATH" "$script" >"$tmpdir/retired.out" 2>&1; then
    printf 'Verification unexpectedly passed with a retired listener\n' >&2
    exit 1
fi
grep -q 'Retired service listener detected on port 8080' "$tmpdir/retired.out"
