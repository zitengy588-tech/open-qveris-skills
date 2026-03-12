# Internal Agent Install Guide

Read this file as the agent that is performing the installation.

Your goal is to install the local `qveris-official` skill for the user without downloading remote files or editing shell startup files unless the user explicitly asks for that persistence step.

## Preconditions

- Confirm the user wants `qveris-official` installed from this local repository copy.
- Confirm Node.js 18+ is available.
- Confirm the user has provided a valid `QVERIS_API_KEY`.

If the key is missing, stop and ask for it before continuing.

## Install Flow

### 1. Copy the full skill directory

Copy the entire local `qveris-official/` folder so that all helper modules remain together:

```bash
mkdir -p ~/.openclaw/skills
cp -R qveris-official ~/.openclaw/skills/
```

### 2. Set the key for the current session

Use a session-scoped export first. Do not modify `~/.bashrc`, `~/.zshrc`, or other shell startup files unless the user explicitly asks for persistent setup.

```bash
export QVERIS_API_KEY="<USER_PROVIDED_KEY>"
```

### 3. Verify the installed files

All of these files should exist after the copy:

```bash
test -f ~/.openclaw/skills/qveris-official/SKILL.md && echo "SKILL.md OK" || echo "SKILL.md MISSING"
test -f ~/.openclaw/skills/qveris-official/scripts/qveris_tool.mjs && echo "qveris_tool.mjs OK" || echo "qveris_tool.mjs MISSING"
test -f ~/.openclaw/skills/qveris-official/scripts/qveris_client.mjs && echo "qveris_client.mjs OK" || echo "qveris_client.mjs MISSING"
test -f ~/.openclaw/skills/qveris-official/scripts/qveris_env.mjs && echo "qveris_env.mjs OK" || echo "qveris_env.mjs MISSING"
echo "QVERIS_API_KEY=${QVERIS_API_KEY:+is set}"
```

### 4. Verify the runtime entrypoint

Run the local CLI help and one discovery command:

```bash
node ~/.openclaw/skills/qveris-official/scripts/qveris_tool.mjs --help
node ~/.openclaw/skills/qveris-official/scripts/qveris_tool.mjs discover "stock price API" --limit 3
```

The help output should mention `discover`, `call`, and `inspect`.  
The discovery command should return tool candidates and a discovery ID.

## Behavior Rules

- Use `discover` to find tools.
- Use `call` to run the selected tool.
- Use `inspect` to re-check a known tool ID.
- Do not say installation succeeded unless the file checks and CLI checks passed.
- If any verification step fails, report the exact failed step and stop.

## Optional Persistence

Only if the user explicitly asks for persistent shell configuration:

- ask which shell file should be updated
- explain the exact line that will be added
- update only after confirmation

Default behavior is non-persistent session setup.
