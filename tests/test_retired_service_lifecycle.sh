#!/usr/bin/env bash
set -euo pipefail

retired_matches=$(grep -nEi \
  'PIPER_PORT|VIBEVOICE7B_PORT|start_piper|start_vibevoice7b|Piper TTS|VibeVoice|8080|8091|vibevoice7b' \
  genki.sh setup.sh || true)

if [[ -n "$retired_matches" ]]; then
  printf 'Retired lifecycle wiring remains:\n%s\n' "$retired_matches" >&2
  exit 1
fi

bash -n genki.sh setup.sh
