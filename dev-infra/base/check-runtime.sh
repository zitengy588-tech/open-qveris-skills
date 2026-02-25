#!/usr/bin/env bash
set -euo pipefail

echo "== Check runtime binaries =="
for cmd in node npm git jq curl; do
  command -v "$cmd" >/dev/null || {
    echo "Missing: $cmd"
    exit 1
  }
  echo "OK: $cmd -> $(command -v "$cmd")"
done

echo "== Check workspace layout =="
test -d /workspace || {
  echo "/workspace not found"
  exit 1
}
test -d /workspace/stock-copilot-pro || {
  echo "/workspace/stock-copilot-pro not found"
  exit 1
}
test -f /workspace/stock-copilot-pro/SKILL.md || {
  echo "/workspace/stock-copilot-pro/SKILL.md not found"
  exit 1
}

echo "== Check env =="
: "${QVERIS_API_KEY:?QVERIS_API_KEY is required}"

echo "All runtime checks passed."
