# Chairman Daily Report - 董事长早晚报

为董事长/高管生成每日早晚报，帮助快速了解上市公司动态、市场情况和决策支持。

## 功能

- 📊 市场概览（大盘指数、板块表现）
- 🏢 公司动态（公告、财报、重大事项）
- 📰 新闻舆情（正面/负面新闻报道）
- ⚠️ 风险预警（公关风险、监管动态）
- 📈 股价分析（涨跌幅、技术指标）
- 💡 决策建议（公关策略、投资建议）

## 安装

1. 确保已安装 `qveris-official` skill
2. 配置 `QVERIS_API_KEY` 环境变量
3. 安装本 skill

## 使用

```bash
# 生成早报
/chairman-daily-report morning

# 生成晚报，指定公司
/chairman-daily-report evening --companies AAPL,TSLA,NVDA

# 飞书格式输出
/chairman-daily-report morning --format feishu
```

## 配置

编辑 `references/company_list.md` 设置默认关注公司。

## 依赖

- qveris-official
- QVERIS_API_KEY

## 作者

QVerisAI
