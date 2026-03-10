# Install QVeris Skill

Follow these steps to install the QVeris skill for yourself. After installation, you will be able to discover external tools by capability and invoke them through QVeris — giving you access to real-time data, API services, and capabilities you do not have natively.

## Prerequisites

You need Node.js 18+ (already present if OpenClaw is installed) and a valid `QVERIS_API_KEY`.

If the user has not provided a key, stop and ask them:

> Please provide your QVERIS_API_KEY. You can obtain one from https://qveris.ai

Do not proceed until a key value is provided.

## Steps

### 1. Create directories

```bash
mkdir -p ~/.openclaw/skills/qveris/scripts
```

### 2. Download skill definition

```bash
curl -fSL https://qveris.ai/skill/SKILL.md -o ~/.openclaw/skills/qveris/SKILL.md
```

### 3. Download tool script

```bash
curl -fSL https://qveris.ai/skill/scripts/qveris_tool.mjs -o ~/.openclaw/skills/qveris/scripts/qveris_tool.mjs
```

### 4. Set QVERIS_API_KEY globally

Write the key to `~/.bashrc` (or `~/.zshrc` if the user's shell is zsh) so it persists across sessions. Replace `<USER_PROVIDED_KEY>` with the actual key the user gave you.

```bash
echo 'export QVERIS_API_KEY="<USER_PROVIDED_KEY>"' >> ~/.bashrc
source ~/.bashrc
```

### 5. Verify

Run all checks below. Every line must pass.

```bash
test -f ~/.openclaw/skills/qveris/SKILL.md && echo "SKILL.md OK" || echo "SKILL.md MISSING"
test -f ~/.openclaw/skills/qveris/scripts/qveris_tool.mjs && echo "qveris_tool.mjs OK" || echo "qveris_tool.mjs MISSING"
echo "QVERIS_API_KEY=${QVERIS_API_KEY:+is set}"
node ~/.openclaw/skills/qveris/scripts/qveris_tool.mjs discover "stock price API" --limit 3
```

The `discover` command should return a list of tool candidates. If all checks pass, the installation is complete — you now have the QVeris skill and can use `discover` and `invoke` as described in SKILL.md.
