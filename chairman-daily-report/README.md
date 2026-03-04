# Chairman Daily Report | 董事长早晚报

**English**: Generate daily morning/evening reports for chairmen/executives to track listed company dynamics, market conditions, and support decision-making.  
**中文**: 为董事长/高管生成每日早晚报，帮助快速了解上市公司动态、市场情况和辅助决策。

---

## Features | 功能

| Icon | English | 中文 |
|------|---------|------|
| 📊 | Market Overview (indices, sector performance) | 市场概览（大盘指数、板块表现） |
| 🏢 | Company Dynamics (announcements, earnings, major events) | 公司动态（公告、财报、重大事项） |
| 📰 | News & Sentiment (positive/negative news coverage) | 新闻舆情（正面/负面新闻报道） |
| ⚠️ | Risk Alerts (PR risks, regulatory updates) | 风险预警（公关风险、监管动态） |
| 📈 | Stock Analysis (price changes, technical indicators) | 股价分析（涨跌幅、技术指标） |
| 💡 | Decision Support (PR strategy, investment advice) | 决策建议（公关策略、投资建议） |

---

## Installation | 安装

**English**:
1. Ensure `qveris-official` skill is installed
2. Configure `QVERIS_API_KEY` environment variable
3. Install this skill

**中文**:
1. 确保已安装 `qveris-official` skill
2. 配置 `QVERIS_API_KEY` 环境变量
3. 安装本 skill

---

## Usage | 使用

```bash
# Generate morning report | 生成早报
/chairman-daily-report morning

# Generate evening report with custom companies | 生成晚报，指定公司
/chairman-daily-report evening --companies AAPL,TSLA,NVDA

# Feishu format output | 飞书格式输出
/chairman-daily-report morning --format feishu
```

### Parameters | 参数

| Parameter | English Description | 中文说明 | Default |
|-----------|---------------------|----------|---------|
| `morning` | Morning report (market open) | 早报（开盘） | - |
| `evening` | Evening report (market close) | 晚报（收盘） | - |
| `--companies` | List of companies to track | 关注公司列表 | AAPL,TSLA,NVDA,MSFT |
| `--format` | Output format | 输出格式 | markdown |
| `--market` | Market code (US/CN/HK) | 市场代码 | US |

---

## Configuration | 配置

**English**: Edit `references/company_list.md` to set default tracked companies.  
**中文**: 编辑 `references/company_list.md` 设置默认关注公司。

---

## Dependencies | 依赖

- [qveris-official](https://github.com/QVerisAI/open-qveris-skills/tree/main/qveris-official)
- `QVERIS_API_KEY` (Get from https://qveris.ai)

---

## Report Structure | 报告结构

### Morning Report | 早报

**English**:
1. Market Opening Overview
2. Tracked Companies Updates
3. News & Sentiment Monitoring
4. Risk Alerts
5. Today's Focus

**中文**:
1. 市场开盘概况
2. 关注公司动态
3. 新闻舆情监控
4. 风险预警
5. 今日关注

### Evening Report | 晚报

**English**:
1. Market Closing Summary
2. Stock Price Analysis
3. Sentiment Changes
4. Risk Review
5. Tomorrow's Outlook

**中文**:
1. 市场收盘总结
2. 公司股价分析
3. 舆情变化
4. 风险回顾
5. 明日展望

---

## Author | 作者

**QVerisAI** - Empowering AI agents with real-world capabilities.

---

## License | 许可证

MIT License
