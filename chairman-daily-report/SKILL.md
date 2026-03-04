---
name: chairman-daily-report
description: Generate daily morning and evening reports for chairmen to track listed company dynamics, news sentiment, PR risks, and stock price impacts. Helps chairmen quickly understand daily market movements and make informed decisions. Integrates with QVeris for financial data, news, and market analysis.
metadata:
  clawdbot:
    requires:
      env: ["QVERIS_API_KEY"]
      skills: ["qveris-official"]
    primaryEnv: "QVERIS_API_KEY"
    files: ["scripts/*"]
---

# Chairman Daily Report - 董事长早晚报

为董事长/高管生成每日早晚报，帮助快速了解上市公司动态、市场情况和决策支持。

## 功能模块

| 模块 | 描述 |
|------|------|
| 市场概览 | 大盘指数、行业板块表现 |
| 公司动态 | 关注公司的最新公告、财报 |
| 新闻舆情 | 相关公司的新闻报道、舆情分析 |
| 风险预警 | 负面新闻、诉讼、监管动态 |
| 股价分析 | 股价变动、技术指标 |
| 决策建议 | 公关建议、投资策略建议 |

## 依赖

- qveris-official: 提供 QVeris API 调用能力
- QVERIS_API_KEY: 环境变量，从 https://qveris.ai 获取

## 使用方式

```
/chairman-daily-report [morning|evening] [options]
```

### 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| morning | 生成早报 | - |
| evening | 生成晚报 | - |
| --companies | 关注公司列表 | AAPL,TSLA,NVDA,MSFT |
| --format | 输出格式: markdown/feishu/html | markdown |
| --market | 市场代码: US/CN/HK | US |

### 示例

```bash
/chairman-daily-report morning
/chairman-daily-report evening --companies BABA,TCEHY
```

## 报告内容

### 早报结构
1. 市场开盘概况
2. 关注公司动态
3. 新闻舆情监控
4. 风险预警
5. 今日关注

### 晚报结构
1. 市场收盘总结
2. 公司股价分析
3. 舆情变化
4. 风险回顾
5. 明日展望

## 配置文件

编辑 references/company_list.md 设置默认关注公司

## 技术实现

本 Skill 通过调用 qveris-official 提供的工具来获取数据：

1. 股价数据: QVeris 金融数据 API
2. 公司新闻: QVeris 新闻搜索 + Web 搜索
3. 舆情分析: QVeris 情感分析工具
4. 风险评估: 本地风险关键词匹配 + AI 分析

## 安全说明

- 仅访问 QVERIS_API_KEY 环境变量
- API 调用仅发送到 https://qveris.ai/api/v1
- 不缓存或存储敏感数据
- 建议定期更换 API Key
