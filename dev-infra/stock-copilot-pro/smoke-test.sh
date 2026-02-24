#!/usr/bin/env bash
set -euo pipefail

echo "[1] Runtime pre-check"
bash /workspace/dev-infra/base/check-runtime.sh

cd /workspace/stock-copilot-pro

echo "[2] Unit tests (no API)"
node --test tests/architecture-modules.test.mjs

echo "[3] Watch e2e (no API key required)"
node --test tests/watch.e2e.test.mjs

echo "[4] Regression smoke suite (requires QVERIS_API_KEY)"
node tests/regression.test.mjs --suite smoke --allow-degraded

echo "[5] Analyze e2e (requires QVERIS_API_KEY)"
node --test tests/analyze.e2e.test.mjs

echo "[6] Compare e2e (requires QVERIS_API_KEY)"
node --test tests/compare.e2e.test.mjs

echo "[7] Brief e2e (requires QVERIS_API_KEY)"
node --test tests/brief.e2e.test.mjs

echo "[8] Radar e2e (requires QVERIS_API_KEY)"
node --test tests/radar.e2e.test.mjs

echo ""
echo "All smoke tests completed."
echo ""
echo "Next: run prompts in a NEW OpenClaw session for manual validation:"
echo " - /workspace/dev-infra/stock-copilot-pro/prompts/001_happy_path.txt"
echo " - /workspace/dev-infra/stock-copilot-pro/prompts/002_invalid_input.txt"
echo " - /workspace/dev-infra/stock-copilot-pro/prompts/003_negative_case.txt"
