# OpenClaw Manual Fallback Setup

Use this fallback only when compose-based OpenClaw startup is unavailable.

## 1) Workspace

- Open desktop OpenClaw and set workspace to repository root:
  `/Users/ocean/codes/QVeris-Opensource/open-qveris-skills`

## 2) Skills loading

- Ensure skill loading includes:
  - `/workspace/stock-copilot-pro` (or equivalent local path)
  - `/workspace/qverisai` (or equivalent local path)
- Enable watcher and create a new session after each SKILL update.

## 3) Runtime env

- Reuse repository root `.env.local` and keep `QVERIS_API_KEY` there.
- Do not rely on host shell exports only.

## 4) Regression loop

- In terminal, run:
  - `make up`
  - `make smoke`
- In OpenClaw, create a new session and run prompts from:
  - `dev-infra/stock-copilot-pro/prompts/`
