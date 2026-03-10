# QVeris Official Skill

The official QVeris skill for OpenClaw and other AI agents. QVeris is a capability discovery and tool invocation engine that helps agents discover tools by capability and invoke them through QVeris.

## Features

- **Capability Discovery**: Discover suitable tools by describing the capability you need in natural language (English queries recommended for best results)
- **Tool Invocation**: Invoke the selected tool through QVeris with structured parameters and get machine-readable responses
- **Unified API Entry**: Use one QVeris entrypoint instead of constructing provider-specific endpoints
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
npx clawdhub install qveris-official
```

**Option 2: Manual Installation**

Copy this folder to your OpenClaw skills directory:
```bash
cp -r qveris-official ~/.openclaw/skills/
```

## Usage

Once installed, your AI agent will automatically use this skill when tasks involve:
- **Data**: stock prices, crypto, forex, commodities, economic indicators, company financials, news, social media analytics, blockchain/on-chain data
- **Tool services**: image/video generation, text-to-speech, OCR, PDF extraction, translation, AI model inference
- **Location & geo**: maps, geocoding, navigation, POI search, satellite imagery
- **Research**: academic papers, patent databases, clinical trials, datasets
- And thousands more...

### Manual Commands

Manual usage follows a two-step flow: **discover tools by capability, then invoke the selected tool through QVeris**.

`discover` returns tool candidates and metadata, not final data results. `invoke` returns the execution result.

```bash
# Discover tools for a capability
node scripts/qveris_tool.mjs discover "stock price data"
node scripts/qveris_tool.mjs discover "image generation" --limit 5

# Invoke the selected tool
node scripts/qveris_tool.mjs invoke <tool_id> --discovery-id <discovery_id> --params '{"symbol": "AAPL"}'

# Inspect a known tool by ID (skip full discovery for known tools)
node scripts/qveris_tool.mjs inspect <tool_id>

# Output raw JSON
node scripts/qveris_tool.mjs discover "weather forecast" --json
node scripts/qveris_tool.mjs invoke <tool_id> --discovery-id <discovery_id> --params '{"city": "London"}' --json
```

## Author

[@QVeris_AI](https://x.com/QVeris_AI)

## License

MIT
