---
name: stock-copilot-pro
description: High-performance global stock analysis copilot powered by QVeris. Fuses quote, fundamentals, technicals, news sentiment, and X sentiment with adaptive tool learning for higher success and better signal quality.
env:
  - QVERIS_API_KEY
credentials:
  required:
    - QVERIS_API_KEY
  primary_env: QVERIS_API_KEY
  scope: read-only
  endpoint: https://qveris.ai/api/v1
network:
  outbound_hosts:
    - qveris.ai
auto_invoke: true
source: https://qveris.ai
examples:
  - "Analyze AAPL with a comprehensive report"
  - "Technical analysis for 0700.HK"
  - "Compare AAPL, MSFT, NVDA"
  - "Give me fundamentals and sentiment for 600519.SS"
---

# Stock Copilot Pro

Global Multi-Source Stock Analysis with QVeris.

## What This Skill Does

Stock Copilot Pro performs end-to-end stock analysis with five data domains:

1. Market quote / trading context
2. Fundamental metrics
3. Technical signals (RSI/MACD/MA)
4. News and sentiment
5. X sentiment

It then generates a data-rich analyst report with:
- value-investing scorecard
- event-timing anti-chasing classification
- safety-margin estimate
- scenario-based recommendations
- standard readable output (default) + optional full evidence trace (`--evidence`)

## Key Advantages

- Deterministic tool routing via `references/tool-chains.json`
- Evolution v2 parameter-template memory to reduce recurring parameter errors
- Strong fallback strategy across providers and markets
- US/HK/CN market-aware symbol handling
- Structured outputs for both analyst reading and machine ingestion
- Safety-first handling of secrets and runtime state

## Core Workflow

1. Resolve user input to symbol + market (supports company-name aliases, e.g. `特变电工` -> `600089.SH`).
2. Search tools by capability (quote, fundamentals, indicators, sentiment, X sentiment).
3. Route by hardcoded tool chains first (market-aware), then fallback generic capability search.
   - For CN/HK sentiment, prioritize `caidazi` channels (report/news/wechat).
   - For CN/HK fundamentals, prioritize THS financial statements (income/balance sheet/cash flow), then fallback to company basics.
4. Before execution, try evolution parameter templates; if unavailable, use default param builder.
5. Run quality checks:
   - Missing key fields
   - Data recency
   - Cross-source inconsistency
6. Produce analyst report with:
   - composite score
   - safety margin
   - event-driven vs pullback-risk timing classification
   - market scenario suggestions
   - optional parsed/raw evidence sections when `--evidence` is enabled

## Command Surface

Primary script: `scripts/stock_copilot_pro.mjs`

- Analyze one symbol:
  - `node scripts/stock_copilot_pro.mjs analyze --symbol AAPL --market US --mode comprehensive`
  - `node scripts/stock_copilot_pro.mjs analyze --symbol "特变电工" --mode comprehensive`
- Compare multiple symbols:
  - `node scripts/stock_copilot_pro.mjs compare --symbols AAPL,MSFT --market US --mode comprehensive`

## CN/HK Coverage Details

- Company-name input is supported and auto-resolved to market + symbol for common names.
- Sentiment path prioritizes `caidazi` (research reports, news, wechat/public-account channels).
- Fundamentals path prioritizes THS financial statements endpoints, and always calls THS company basics for profile backfill:
  - `revenue`
  - `netProfit`
  - `totalAssets`
  - `totalLiabilities`
  - `operatingCashflow`
  - `industry`
  - `mainBusiness`
  - `tags`

## Output Modes

- `markdown` (default): human-readable report
- `json`: machine-readable merged payload

## Dynamic Evolution

- Runtime learning state is stored in `.evolution/tool-evolution.json`.
- One successful execution can update tool parameter templates.
- Evolution stores `param_templates` and `sample_successful_params` for reuse.
- Evolution does not decide tool priority; tool priority is controlled by `tool-chains.json`.
- Use `--no-evolution` to disable loading/saving runtime learning state.

## Safety and Disclosure

- Uses only `QVERIS_API_KEY`.
- Calls only QVeris APIs over HTTPS.
- Does not store API keys in logs, reports, or evolution state.
- Runtime persistence is limited to `.evolution/tool-evolution.json` (metadata + parameter templates only).
- No package installation or arbitrary command execution is performed by this skill script.
- Research-only output. Not investment advice.

