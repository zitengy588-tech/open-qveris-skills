<!-- Language Switcher -->
<div align="center">

**[English](#english) | [中文](#中文)**

</div>

---

<a name="english"></a>
# 📊 Chairman Daily Report

> AI-Powered Daily Intelligence for Executives

Generate comprehensive morning and evening reports for chairmen and executives to track listed company dynamics, monitor market conditions, analyze news sentiment, and support strategic decision-making.

## ✨ Features

### 📈 Market Intelligence
- **Market Overview**: Real-time indices (S&P 500, Dow Jones, NASDAQ, etc.)
- **Sector Performance**: Industry tracking and trend analysis
- **Global Markets**: US, China A-Shares, Hong Kong markets

### 🏢 Company Tracking
- **Portfolio Monitoring**: Track your watchlist companies
- **Earnings Alerts**: Quarterly reports and financial updates
- **Corporate Actions**: M&A, dividends, stock splits

### 📰 News & Sentiment Analysis
- **News Aggregation**: Real-time news from multiple sources
- **Sentiment Scoring**: AI-powered positive/negative analysis
- **Trend Detection**: Emerging topics and narratives

### ⚠️ Risk Management
- **Risk Alerts**: Negative news, lawsuits, regulatory issues
- **Crisis Detection**: Early warning for PR emergencies
- **Compliance Monitoring**: Regulatory filings and investigations

### 💡 Decision Support
- **PR Recommendations**: Strategic communication advice
- **Investment Insights**: Market timing and positioning
- **Executive Summary**: Key takeaways for busy leaders

## 🚀 Quick Start

### Prerequisites
- [qveris-official](https://github.com/QVerisAI/open-qveris-skills/tree/main/qveris-official) skill installed
- `QVERIS_API_KEY` from [qveris.ai](https://qveris.ai)

### Installation
```bash
# Install the skill
openclaw skill install chairman-daily-report

# Or clone manually
git clone https://github.com/QVerisAI/open-qveris-skills.git
cd open-qveris-skills/chairman-daily-report
```

### Usage Examples
```bash
# Morning report (market open)
/chairman-daily-report morning

# Evening report with custom companies
/chairman-daily-report evening --companies AAPL,TSLA,NVDA,BABA

# Feishu/Lark format for team sharing
/chairman-daily-report morning --format feishu

# Hong Kong stock market
/chairman-daily-report morning --market HK --companies 0700.HK,9988.HK
```

## 📋 Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `morning` | Morning market open report | - |
| `evening` | Evening market close report | - |
| `--companies` | Comma-separated stock symbols | AAPL,TSLA,NVDA,MSFT |
| `--format` | Output format: `markdown`, `feishu`, `html` | markdown |
| `--market` | Market code: `US`, `CN`, `HK` | US |

## 📄 Report Structure

### Morning Report
1. **Executive Summary** - Key highlights at a glance
2. **Market Opening** - Pre-market and opening bell data
3. **Portfolio Updates** - Your tracked companies overnight
4. **News Digest** - Curated news with sentiment analysis
5. **Risk Radar** - Potential issues requiring attention
6. **Today's Agenda** - Earnings calls, events, deadlines

### Evening Report
1. **Market Recap** - Full trading day summary
2. **Performance Analysis** - Winners, losers, volume leaders
3. **Sentiment Shift** - How news moved markets today
4. **Risk Review** - Today's issues and response status
5. **Tomorrow's Outlook** - Events and expectations

## ⚙️ Configuration

Edit `references/company_list.md` to customize your default watchlist:

```markdown
# My Watchlist

## US Tech Giants
- AAPL: Apple Inc.
- MSFT: Microsoft Corp.
- GOOGL: Alphabet Inc.
- AMZN: Amazon.com Inc.

## Chinese Tech
- BABA: Alibaba Group
- TCEHY: Tencent Holdings
- JD: JD.com Inc.
```

## 🔧 Technical Architecture

This skill leverages the `qveris-official` skill for:

| Data Source | QVeris Tool | Description |
|-------------|-------------|-------------|
| Stock Prices | Financial Data API | Real-time and historical prices |
| Company News | News Search | Aggregated news feeds |
| Sentiment | NLP Analysis | AI-powered sentiment scoring |
| Risk Detection | Web Search + AI | Multi-source risk identification |

## 🔒 Security & Privacy

- **API Key**: Only `QVERIS_API_KEY` is accessed
- **Data Transmission**: HTTPS only to `qveris.ai`
- **No Data Persistence**: Reports are generated on-demand, not stored
- **Scope**: Read-only market data access

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📜 License

MIT License - see [LICENSE](../LICENSE) for details.

---

<div align="center">

**[⬆ Back to Top](#english) | [切换到中文](#中文)**

</div>

---

<a name="中文"></a>
# 📊 董事长早晚报

> AI 驱动的 executives 每日情报助手

为董事长和高管生成全面的早晚报告，追踪上市公司动态、监控市场状况、分析新闻舆情，并支持战略决策。

## ✨ 功能特点

### 📈 市场情报
- **市场概览**：实时指数（标普 500、道琼斯、纳斯达克等）
- **板块表现**：行业追踪和趋势分析
- **全球市场**：美股、A股、港股全覆盖

### 🏢 公司追踪
- **持仓监控**：追踪您的关注列表公司
- **财报提醒**：季度报告和财务更新
- **公司动态**：并购、分红、拆股等重大事项

### 📰 新闻与舆情分析
- **新闻聚合**：多源实时新闻
- **情感评分**：AI 驱动的正负面分析
- **趋势检测**：新兴话题和叙事

### ⚠️ 风险管理
- **风险预警**：负面新闻、诉讼、监管问题
- **危机检测**：公关紧急情况早期预警
- **合规监控**：监管文件和调查跟踪

### 💡 决策支持
- **公关建议**：战略沟通建议
- **投资洞察**：市场时机和仓位建议
- **高管摘要**：为忙碌的领导提供关键要点

## 🚀 快速开始

### 前置条件
- 已安装 [qveris-official](https://github.com/QVerisAI/open-qveris-skills/tree/main/qveris-official) skill
- 从 [qveris.ai](https://qveris.ai) 获取 `QVERIS_API_KEY`

### 安装
```bash
# 安装 skill
openclaw skill install chairman-daily-report

# 或手动克隆
git clone https://github.com/QVerisAI/open-qveris-skills.git
cd open-qveris-skills/chairman-daily-report
```

### 使用示例
```bash
# 早报（开盘）
/chairman-daily-report morning

# 晚报，指定公司
/chairman-daily-report evening --companies AAPL,TSLA,NVDA,BABA

# 飞书格式，便于团队分享
/chairman-daily-report morning --format feishu

# 港股市场
/chairman-daily-report morning --market HK --companies 0700.HK,9988.HK
```

## 📋 参数说明

| 参数 | 说明 | 默认值 |
|-----------|-------------|---------|
| `morning` | 早报（开盘） | - |
| `evening` | 晚报（收盘） | - |
| `--companies` | 逗号分隔的股票代码 | AAPL,TSLA,NVDA,MSFT |
| `--format` | 输出格式：`markdown`, `feishu`, `html` | markdown |
| `--market` | 市场代码：`US`, `CN`, `HK` | US |

## 📄 报告结构

### 早报内容
1. **高管摘要** - 一目了然的关键要点
2. **开盘概况** - 盘前和开盘钟数据
3. **持仓更新** - 您追踪的公司隔夜动态
4. **新闻摘要** - 精选新闻和情感分析
5. **风险雷达** - 需要注意的潜在问题
6. **今日议程** - 财报电话会、事件、截止日期

### 晚报内容
1. **市场回顾** - 全天交易总结
2. **表现分析** - 赢家、输家、成交量领先者
3. **舆情变化** - 今日新闻如何影响市场
4. **风险回顾** - 今日问题和响应状态
5. **明日展望** - 事件和预期

## ⚙️ 配置

编辑 `references/company_list.md` 自定义您的默认关注列表：

```markdown
# 我的关注列表

## 美股科技巨头
- AAPL: Apple Inc.
- MSFT: Microsoft Corp.
- GOOGL: Alphabet Inc.
- AMZN: Amazon.com Inc.

## 中国科技
- BABA: Alibaba Group
- TCEHY: Tencent Holdings
- JD: JD.com Inc.
```

## 🔧 技术架构

本 skill 利用 `qveris-official` skill 提供：

| 数据来源 | QVeris 工具 | 说明 |
|-------------|-------------|-------------|
| 股价 | Financial Data API | 实时和历史价格 |
| 公司新闻 | News Search | 聚合新闻源 |
| 情感分析 | NLP Analysis | AI 驱动的情感评分 |
| 风险检测 | Web Search + AI | 多源风险识别 |

## 🔒 安全与隐私

- **API Key**：仅访问 `QVERIS_API_KEY`
- **数据传输**：仅通过 HTTPS 到 `qveris.ai`
- **无数据持久化**：报告按需生成，不存储
- **权限范围**：只读市场数据访问

## 🤝 贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解指南。

## 📜 许可证

MIT 许可证 - 详见 [LICENSE](../LICENSE)

---

<div align="center">

**[⬆ 返回顶部](#中文) | [Switch to English](#english)**

</div>
