---
name: stock-copilot-pro
description: OpenClaw stock analysis skill for US/HK/CN markets. Combines QVeris data sources (THS, Caidazi, Alpha Vantage, Finnhub, X sentiment) for quote, fundamentals, technicals, news radar, morning/evening brief, and actionable investment insights.
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

## SEO Keywords

OpenClaw, stock analysis skill, AI stock copilot, A股分析, 港股分析, 美股分析, 量化分析, 基本面分析, 技术分析, 情绪分析, 行业热点雷达, 早报晚报, watchlist, portfolio monitoring, QVeris API, THS iFinD, Caidazi, Alpha Vantage, Finnhub, X sentiment, investment research assistant

## Supported Capabilities

- Single-stock analysis (`analyze`): valuation, quality, technicals, sentiment, risk/timing
- Multi-stock comparison (`compare`): cross-symbol ranking and portfolio-level view
- Watchlist/holdings management (`watch`): list/add/remove for holdings and watchlist
- Morning/Evening brief (`brief`): holdings-focused daily actionable briefing
- Industry hot-topic radar (`radar`): multi-source topic aggregation for investable themes
- Multi-format output: `markdown`, `json`, `chat`
- OpenClaw LLM-ready flow: structured data in code + guided narrative in `SKILL.md`

## Data Sources

- Core MCP/API gateway: `qveris.ai` (`QVERIS_API_KEY`)
- CN/HK quote and fundamentals:
  - `ths_ifind.real_time_quotation`
  - `ths_ifind.financial_statements`
  - `ths_ifind.company_basics`
  - `ths_ifind.history_quotation`
- CN/HK news and research:
  - `caidazi.news.query`
  - `caidazi.report.query`
  - `caidazi.search.hybrid.list`
  - `caidazi.search.hybrid_v2.query`
- Global news sentiment:
  - `alpha_news_sentiment`
  - `finnhub.news`
- X/Twitter sentiment and hot topics:
  - `qveris_social.x_domain_hot_topics`
  - `qveris_social.x_domain_hot_events`
  - `qveris_social.x_domain_new_posts`
  - `x_developer.2.tweets.search.recent`

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
- thesis-driven investment framework (drivers/risks/scenarios/KPIs)
- multi-style playbooks (value/balanced/growth/trading)
- event radar with candidate ideas from news and X
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
   - structured thesis (driver/risk/scenario/KPI)
   - event radar (timeline/theme) and candidate ideas
   - style-specific execution playbooks
   - market scenario suggestions
   - optional parsed/raw evidence sections when `--evidence` is enabled

7. Preference routing (public audience default):
   - If no preference flags are provided, script returns a questionnaire first.
   - You can skip this with `--skip-questionnaire`.

## Command Surface

Primary script: `scripts/stock_copilot_pro.mjs`

- Analyze one symbol:
  - `node scripts/stock_copilot_pro.mjs analyze --symbol AAPL --market US --mode comprehensive`
  - `node scripts/stock_copilot_pro.mjs analyze --symbol "特变电工" --mode comprehensive`
- Compare multiple symbols:
  - `node scripts/stock_copilot_pro.mjs compare --symbols AAPL,MSFT --market US --mode comprehensive`
- Manage watchlist:
  - `node scripts/stock_copilot_pro.mjs watch --action list`
  - `node scripts/stock_copilot_pro.mjs watch --action add --bucket holdings --symbol AAPL --market US`
  - `node scripts/stock_copilot_pro.mjs watch --action remove --bucket watchlist --symbol 0700.HK --market HK`
- Generate brief:
  - `node scripts/stock_copilot_pro.mjs brief --type morning --format chat`
  - `node scripts/stock_copilot_pro.mjs brief --type evening --format markdown`
- Run industry radar:
  - `node scripts/stock_copilot_pro.mjs radar --market GLOBAL --limit 10`

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
- `chat`: segmented chat-friendly output for messaging apps
- `summary-first`: compact output style via `--summary-only`

## Preference & Event Options

- Preference flags:
  - `--horizon short|mid|long`
  - `--risk low|mid|high`
  - `--style value|balanced|growth|trading`
  - `--actionable` (include execution-oriented rules)
  - `--skip-questionnaire` (force analysis without preference Q&A)

- Event radar flags:
  - `--event-window-days 7|14|30`
  - `--event-universe global|same_market`
  - `--event-view timeline|theme`

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
- Watchlist state is stored at `config/watchlist.json` (bootstrap from `config/watchlist.example.json`).
- OpenClaw cron integration example is available at `config/openclaw-cron.example.json`.
- No package installation or arbitrary command execution is performed by this skill script.
- Research-only output. Not investment advice.

## Single Stock Analysis Guide

When analyzing `analyze` output, act as a senior buy-side analyst and deliver a **professional but not overlong** report.

### Required Output (5 Sections)

1. **核心观点（30秒）**
   - One-line conclusion: buy/hold/avoid + key reason.

2. **投资逻辑**
   - 多头逻辑: 2 points (growth driver, moat/catalyst)
   - 空头逻辑: 2 points (valuation/risk/timing)
   - Final balance: what dominates now.

3. **估值与关键价位**
   - PE/PB vs peer or history percentile (cheap/fair/expensive)
   - Key levels: current price, support, resistance, stop-loss reference

4. **投资建议（必须）**
   - Different advice by position status:
     - 空仓
     - 轻仓
     - 重仓/被套
   - Each suggestion must include concrete trigger/price/condition.

5. **风险监控**
   - Top 2-3 risks + invalidation condition (what proves thesis wrong).

### Quality Bar

- Avoid data dumping; each key number must include interpretation.
- Keep concise but complete (target 250-500 Chinese characters).
- Must include actionable guidance and time window.
- Use Chinese for narrative; keep ticker/technical terms in English.

## Daily Brief Analysis Guide

When analyzing `brief` output, generate an actionable morning/evening briefing for OpenClaw conversation.

### Morning Brief (早报)

1. **市场概况**: risk-on/off + key overnight move + today's tone
2. **持仓检视**: holdings that need action first
3. **热点关联**: which radar themes impact holdings
4. **今日计划（必须）**: specific watch levels / event / execution plan

### Evening Brief (晚报)

1. **今日复盘**: index + sector + portfolio one-line recap
2. **持仓变化**: biggest winners/losers and why
3. **逻辑复核**: whether thesis changed
4. **明日计划（必须）**: explicit conditions and actions

### Quality Bar

- Prioritize user holdings, not generic market commentary.
- Quantify changes when possible (%, levels, counts).
- Keep concise and decision-oriented.

## Hot Topic Analysis Guide

When analyzing `radar` output, cluster signals into investable themes and provide concise actionable conclusions.

### Required Output (per theme)

- **主题**: clear, investable label
- **核心驱动**: what changed and why now
- **影响评估**: beneficiaries/losers + magnitude + duration
- **投资建议（必须）**: concrete trigger or level
- **风险提示**: key invalidation or monitoring signal

### Execution Rules

- Cluster into 3-5 themes max.
- Cross-verify sources; lower confidence for social-only signals.
- Distinguish short-term trade vs mid-term allocation.
- Keep each theme concise (<200 Chinese characters preferred).

