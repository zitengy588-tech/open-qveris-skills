# QVeris Official Skill

The official QVeris skill for OpenClaw and other AI agents. Enables semantic tool discovery and unified execution across thousands of professional data sources, tool services, and SaaS integrations via the QVeris API.

## Features

- **Semantic Tool Discovery**: Search for APIs, tools, and services by describing what you need in natural language
- **Unified Execution**: Execute any discovered tool with structured parameters and get machine-readable responses
- **Wide Coverage**: Financial markets, economics, news, social media, blockchain, AI/ML, image/video generation, geocoding, navigation, academic research, healthcare, weather, cloud services, and thousands more
- **Zero Extra Dependencies**: Uses only Node.js built-in `fetch` — no Python, no `uv`, no npm install

## Installation

### Prerequisites

- **Node.js 18+** (already present if you have OpenClaw installed)
- **QVERIS_API_KEY** — get your API key at https://qveris.ai

Set your API key:
```bash
export QVERIS_API_KEY="your-api-key-here"
```

### Install the Skill

**Option 1: Install via ClawdHub (Recommended)**
```bash
clawdhub install qveris
```

**Option 2: Install via NPX (For other coding agents)**
```bash
npx skills add hqman/qveris
```

**Option 3: Manual Installation**

Copy this folder to your OpenClaw skills directory:
```bash
cp -r qveris ~/.openclaw/skills/
```

## Usage

Once installed, OpenClaw will automatically use this skill when tasks involve:
- Real-time data (stock prices, crypto, forex, weather, news, economic indicators)
- Tool capabilities (image/video generation, translation, OCR, content processing)
- External services (geocoding, navigation, email, cloud storage, automation)
- Research (academic papers, clinical trials, patent search)
- And thousands more...

### Manual Commands

```bash
# Search for tools
node scripts/qveris_tool.mjs search "stock price data"

# Execute a tool
node scripts/qveris_tool.mjs execute <tool_id> --search-id <id> --params '{"symbol": "AAPL"}'
```

## Author

[@hqmank](https://x.com/hqmank)

## License

MIT
