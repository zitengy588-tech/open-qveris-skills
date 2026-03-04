#!/usr/bin/env python3
"""
格式化输出 - 生成报告
"""

from datetime import datetime
from typing import List, Dict, Any

def format_report(
    report_type: str,
    market_data: Dict[str, Any],
    news_data: Dict[str, List[Dict[str, Any]]],
    sentiment_data: Dict[str, Any],
    risk_data: Dict[str, Any],
    companies: List[str],
    output_format: str = "markdown"
) -> str:
    """
    格式化报告
    
    Args:
        report_type: 'morning' 或 'evening'
        market_data: 市场数据
        news_data: 新闻数据
        sentiment_data: 舆情数据
        risk_data: 风险数据
        companies: 关注公司列表
        output_format: 输出格式
        
    Returns:
        格式化后的报告
    """
    if output_format == "feishu":
        return format_feishu_report(report_type, market_data, news_data, sentiment_data, risk_data, companies)
    elif output_format == "html":
        return format_html_report(report_type, market_data, news_data, sentiment_data, risk_data, companies)
    else:
        return format_markdown_report(report_type, market_data, news_data, sentiment_data, risk_data, companies)

def format_markdown_report(
    report_type: str,
    market_data: Dict[str, Any],
    news_data: Dict[str, List[Dict[str, Any]]],
    sentiment_data: Dict[str, Any],
    risk_data: Dict[str, Any],
    companies: List[str]
) -> str:
    """生成 Markdown 格式报告"""
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    report_name = "早报" if report_type == "morning" else "晚报"
    
    lines = []
    lines.append(f"# 📊 董事长{report_name} - {now}")
    lines.append("")
    
    # 1. 市场概览
    lines.append("## 📈 市场概览")
    lines.append("")
    
    if market_data.get("note"):
        lines.append(f"*{market_data['note']}*")
        lines.append("")
    
    for index in market_data.get("indices", []):
        change_emoji = "🟢" if "+" in str(index.get("change_percent", "")) else "🔴"
        lines.append(f"- {change_emoji} **{index['name']}** ({index['symbol']}): {index['price']} ({index.get('change_percent', 'N/A')})")
    
    lines.append("")
    
    # 2. 关注公司新闻
    lines.append("## 🏢 关注公司动态")
    lines.append("")
    
    for company in companies:
        lines.append(f"### {company}")
        company_news = news_data.get(company, [])
        
        if not company_news:
            lines.append("- 暂无重要新闻")
        else:
            for news in company_news[:3]:  # 最多显示 3 条
                lines.append(f"- 📰 [{news['source']}] {news['title']}")
                if news.get('summary'):
                    lines.append(f"  > {news['summary'][:80]}...")
        lines.append("")
    
    # 3. 舆情分析
    lines.append("## 📰 舆情分析")
    lines.append("")
    
    sentiment_emoji = {"positive": "🟢 正面", "neutral": "⚪ 中性", "negative": "🔴 负面"}
    overall = sentiment_data.get("overall", "neutral")
    lines.append(f"**整体舆情**: {sentiment_emoji.get(overall, overall)}")
    lines.append("")
    
    # 各公司情感
    lines.append("| 公司 | 舆情 | 正面 | 负面 | 中性 |")
    lines.append("|------|------|------|------|------|")
    for company in companies:
        s = sentiment_data.get("company_sentiment", {}).get(company, {})
        sentiment_label = sentiment_emoji.get(s.get("sentiment", "neutral"), "⚪")
        lines.append(f"| {company} | {sentiment_label} | {s.get('positive_count', 0)} | {s.get('negative_count', 0)} | {s.get('neutral_count', 0)} |")
    lines.append("")
    
    # 4. 风险预警
    lines.append("## ⚠️ 风险预警")
    lines.append("")
    
    risk_level = risk_data.get("risk_level", "low")
    risk_emoji = {"low": "🟢 低风险", "medium": "🟡 中风险", "high": "🔴 高风险"}
    lines.append(f"**整体风险等级**: {risk_emoji.get(risk_level, risk_level)}")
    lines.append("")
    
    if risk_data.get("risks"):
        for risk in risk_data["risks"][:5]:  # 最多显示 5 条
            level_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}
            lines.append(f"- {level_emoji.get(risk['level'], '⚪')} **[{risk['company']}]** {risk['type']}: {risk['title']}")
    else:
        lines.append("- ✅ 未检测到明显风险")
    
    lines.append("")
    
    # 5. 公关建议
    from risk_detection import get_pr_recommendation
    lines.append("## 💡 公关建议")
    lines.append("")
    lines.append(get_pr_recommendation(risk_data))
    lines.append("")
    
    # 6. 关键主题
    if sentiment_data.get("key_topics"):
        lines.append("## 🏷️ 关键主题")
        lines.append("")
        lines.append(", ".join([f"`{topic}`" for topic in sentiment_data["key_topics"]]))
        lines.append("")
    
    lines.append("---")
    lines.append("*本报告由 Chairman Daily Report Skill 自动生成*")
    lines.append("*数据来源: QVeris AI*")
    
    return "\n".join(lines)

def format_feishu_report(
    report_type: str,
    market_data: Dict[str, Any],
    news_data: Dict[str, List[Dict[str, Any]]],
    sentiment_data: Dict[str, Any],
    risk_data: Dict[str, Any],
    companies: List[str]
) -> str:
    """生成飞书卡片格式报告 (简化版 Markdown)"""
    # 复用 Markdown 格式，飞书支持 Markdown
    return format_markdown_report(report_type, market_data, news_data, sentiment_data, risk_data, companies)

def format_html_report(
    report_type: str,
    market_data: Dict[str, Any],
    news_data: Dict[str, List[Dict[str, Any]]],
    sentiment_data: Dict[str, Any],
    risk_data: Dict[str, Any],
    companies: List[str]
) -> str:
    """生成 HTML 格式报告"""
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    report_name = "早报" if report_type == "morning" else "晚报"
    
    # 生成 HTML (简化版)
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>董事长{report_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #1a73e8; }}
        h2 {{ color: #333; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; }}
        .positive {{ color: #4caf50; }}
        .negative {{ color: #f44336; }}
        .neutral {{ color: #757575; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f5f5f5; }}
    </style>
</head>
<body>
    <h1>📊 董事长{report_name} - {now}</h1>
    <p>本报告由 Chairman Daily Report Skill 自动生成</p>
</body>
</html>"""
    
    return html

if __name__ == "__main__":
    # 测试
    test_data = {
        "market_data": {"indices": [{"symbol": "^GSPC", "name": "标普 500", "price": "4500", "change_percent": "+0.34%"}]},
        "news_data": {"AAPL": [{"title": "Test", "source": "Test", "summary": "Test"}]},
        "sentiment_data": {"overall": "positive", "company_sentiment": {"AAPL": {"sentiment": "positive", "positive_count": 1, "negative_count": 0, "neutral_count": 0}}, "key_topics": ["财报"]},
        "risk_data": {"risk_level": "low", "risks": []},
        "companies": ["AAPL"],
        "report_type": "morning"
    }
    
    result = format_markdown_report(
        test_data["report_type"],
        test_data["market_data"],
        test_data["news_data"],
        test_data["sentiment_data"],
        test_data["risk_data"],
        test_data["companies"]
    )
    print(result)
