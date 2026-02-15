# Stock Copilot Pro

Global multi-source stock analysis skill for ClawHub/OpenClaw style agents.

## Highlights

- Full-stack market intelligence: quote, fundamentals, technicals, news sentiment, and X sentiment
- Adaptive routing with fallback and dynamic tool learning (improves with usage)
- Cross-market support for US/HK/CN with market-aware symbol normalization
- Company-name friendly flow: auto resolves common company names to ticker + market (e.g. `特变电工` -> `600089.SH`)
- CN/HK sentiment enhanced with `caidazi` channels (research reports, news, WeChat/public accounts)
- CN/HK fundamentals enhanced with THS financial statements (income/balance sheet/cash flow)
- Data quality guardrails: completeness, freshness, and cross-source consistency checks
- Structured outputs for both human workflows (`markdown`) and downstream systems (`json`)

## Why It Stands Out

- **Reliable in noisy API environments**: auto-fallback when a provider degrades or rejects symbols.
- **Learns what works**: builds a priority queue of historically successful tools.
- **Signal fusion, not single-source bias**: combines market data and sentiment channels.
- **Security-minded by default**: avoids key leakage and keeps evolution state metadata-only.

## Requirements

- Node.js 18+
- `QVERIS_API_KEY`

```bash
export QVERIS_API_KEY="your-api-key"
```

## Install as an Independent Skill

```bash
npx skills add <repo-url> --skill stock-copilot-pro
```

Or copy this folder directly into your agent skill directory.

## What You Get

- One-symbol analysis with confidence and risk notes
- Multi-symbol comparison for portfolio-level decisions
- Unified report sections:
  - `summary`
  - `fundamentals`
    - includes financial report fields when available (`revenue`, `netProfit`, `totalAssets`, `totalLiabilities`, `operatingCashflow`)
  - `technicals`
  - `sentiment` (news + X)
  - `risks`
  - `conclusion`

## Usage

### Analyze one symbol

```bash
node scripts/stock_copilot_pro.mjs analyze --symbol AAPL --market US --mode comprehensive
```

### Analyze HK/CN symbols

```bash
node scripts/stock_copilot_pro.mjs analyze --symbol 0700 --market HK --mode technical
node scripts/stock_copilot_pro.mjs analyze --symbol 600519 --market CN --mode comprehensive
node scripts/stock_copilot_pro.mjs analyze --symbol "特变电工" --mode comprehensive
```

### Compare multiple symbols

```bash
node scripts/stock_copilot_pro.mjs compare --symbols AAPL,MSFT,NVDA --market GLOBAL --mode comprehensive
```

### JSON output

```bash
node scripts/stock_copilot_pro.mjs analyze --symbol AAPL --format json
```

### Dynamic learning behavior

- First run: discovers and evaluates candidate tools
- Later runs: prioritizes tools learned from successful executions
- Evolution state file: `.evolution/tool-evolution.json`
- Persistence is minimal by design: tool routing stats only (no API key, no auth header, no raw payload)
- You can disable persistence per run with `--no-evolution`

## Prompt Examples

- `Give me a comprehensive report for AAPL`
- `Analyze 0700.HK with technical focus`
- `Compare AAPL, MSFT, NVDA and rank by risk-reward`
- `Analyze 600519 with fundamentals and sentiment`
- `Give me AAPL analysis with X sentiment included`
- `Compare 0700.HK and 600519 across fundamentals and sentiment`

## Options

- `--market`: `US|HK|CN|GLOBAL` (default: `GLOBAL`)
- `--mode`: `basic|fundamental|technical|comprehensive` (default: `comprehensive`)
- `--format`: `markdown|json` (default: `markdown`)
- `--limit`: search result count per capability (default: `10`)
- `--max-size`: max response bytes per execution (default: `30000`)
- `--timeout`: timeout in seconds (default: `25`)
- `--include-source-urls`: include provider `full_content_file_url` in output (off by default)
- `--no-evolution`: disable reading/writing `.evolution/tool-evolution.json` for this run

## Notes

- Data availability can vary by symbol and provider.
- The script will attempt fallback tools and clearly report missing sections.
- External source URLs are hidden by default in report output.
- X sentiment may use direct ticker search first and fall back to finance-domain hot posts when needed.

## Troubleshooting

- `QVERIS_API_KEY environment variable is required`
  - Export the key first, then rerun.
- Some symbols return sparse/empty fields
  - Retry with market-specific code format (`0700.HK`, `600519.SH`).
  - For CN/HK fundamentals, the script prioritizes THS financial statements before generic company basics.
  - Use `--mode basic` to get a quick quote/fundamentals baseline.
- Sentiment endpoint rejects ticker format
  - Script falls back to general market news and adds warnings in `risks`.
- X query result quality is noisy
  - Use stricter queries or combine with `fundamental` mode for better filtering.
- Rate-limited providers
  - Wait 30-60 seconds and retry, or reduce request burst.

## Live Validation Snapshot

Validated via QVeris MCP tool executions:

- `US (AAPL)`:
  - Quote: success
  - Fundamentals: success
  - Technicals: success
  - Sentiment: success
  - X sentiment: success
- `HK (0700.HK)`:
  - Quote: success (THS real-time quotation)
  - Fundamentals: success (THS financial statements / company basics fallback)
  - Technical trend: success (THS history quotation)
  - Sentiment: fallback when ticker format is rejected
  - X sentiment: success (cached and direct query path verified)
- `CN (600519.SH/600519.SS)`:
  - Quote: success (THS real-time quotation)
  - Fundamentals: success (THS financial statements / company basics fallback)
  - Technical trend: success (THS history quotation / RSI where available)
  - Sentiment: fallback when ticker format is rejected
  - X sentiment: success (direct or fallback path verified)
- `CN company-name input (特变电工)`:
  - Input resolution: success (`特变电工` -> `600089.SH`)
  - News: success (`caidazi.news.query`)
  - Research reports: success (`caidazi.report.query`)
  - Fundamentals: success (`ths_ifind.financial_statements`, income statement fields verified)

## Security

- Never hardcode `QVERIS_API_KEY` in committed files.
- `.env.local` is supported for local testing but should not be uploaded.
- Runtime evolution state stores tool metadata and performance stats only.
- API keys and authorization headers are not persisted in evolution files.
- Evolution state is pruned with bounded size to avoid unbounded local persistence.
- Script calls only QVeris APIs (`qveris.ai`) and does not install packages or run arbitrary commands.

## Disclaimer

This skill is for research and educational purposes only.  
It does not constitute financial or investment advice.

