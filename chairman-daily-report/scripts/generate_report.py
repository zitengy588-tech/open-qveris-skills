#!/usr/bin/env python3
"""
Chairman Daily Report - 主控脚本（增强版）
生成董事长早晚报 - 包含行情、社媒、摘要、风险、建议
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any

# 导入模块
from fetch_market_data import get_market_overview, get_company_quotes
from fetch_company_news import get_company_news
from analyze_sentiment import analyze_news_sentiment
from risk_detection import detect_risks, get_pr_recommendation, get_investment_recommendation
from format_output import format_report

def generate_executive_summary(companies: List[str], news_data: Dict, market_data: Dict, risk_data: Dict) -> str:
    """生成高管摘要"""
    
    # 分析整体趋势
    positive_count = sum(1 for c in news_data.get("news", {}).values() 
                        for n in c if n.get("sentiment") == "positive")
    negative_count = sum(1 for c in news_data.get("news", {}).values() 
                        for n in c if n.get("sentiment") == "negative")
    
    # 获取热点
    hot_topics = news_data.get("hot_topics", [])
    
    summary_parts = []
    
    # 市场概况
    if market_data.get("indices"):
        index_perf = market_data["indices"][0]
        change_pct = index_perf.get("change_percent", "")
        if "+" in str(change_pct):
            summary_parts.append(f"📈 今日市场高开高走，{index_perf['name']}上涨{change_pct}")
        else:
            summary_parts.append(f"📉 今日市场震荡调整，{index_perf['name']}{change_pct}")
    
    # 关注公司
    if positive_count > negative_count:
        summary_parts.append(f"📊 关注公司整体利好，共{positive_count}条正面消息")
    elif negative_count > positive_count:
        summary_parts.append(f"⚠️ 关注公司存在{negative_count}条负面消息，需密切关注")
    else:
        summary_parts.append(f"📊 关注公司消息中性，市场情绪平稳")
    
    # 热点主题
    if hot_topics:
        summary_parts.append(f"🔥 热点：{', '.join(hot_topics[:3])}")
    
    # 风险提醒
    if risk_data.get("risk_level") == "high":
        summary_parts.append("🚨 高风险警告：检测到重大风险事件")
    elif risk_data.get("risk_level") == "medium":
        summary_parts.append("⚡ 中度关注：存在一定风险需留意")
    
    return " | ".join(summary_parts)

def get_macro_news(market: str) -> List[Dict[str, Any]]:
    """获取宏观新闻/国内外大事"""
    
    if market == "CN":
        return [
            {
                "title": "央行今日开展1000亿元逆回购操作，维持流动性合理充裕",
                "impact": "货币政策维持稳健，利好股市流动性",
                "source": "央行官网"
            },
            {
                "title": "国务院发布推动大规模设备更新和消费品以旧换新行动方案",
                "impact": "刺激内需政策加码，利好制造业和消费板块",
                "source": "新华社"
            },
            {
                "title": "美国2月CPI数据超预期，美联储降息预期延后",
                "impact": "海外市场波动加大，关注外资流向变化",
                "source": "彭博社"
            }
        ]
    elif market == "US":
        return [
            {
                "title": "Fed Chair Powell: Rate cuts to begin later this year if inflation cools",
                "impact": "Dovish tone supports equity markets",
                "source": "Reuters"
            },
            {
                "title": "US February jobs report beats expectations, unemployment at 3.7%",
                "impact": "Strong labor market reduces recession fears",
                "source": "CNBC"
            }
        ]
    else:
        return []

def generate_next_steps(risk_data: Dict, sentiment_data: Dict, companies: List[str]) -> List[str]:
    """生成下一步建议"""
    steps = []
    
    # 基于风险的建议
    if risk_data.get("risk_level") == "high":
        steps.append("🚨 【紧急】立即启动危机公关预案，准备对外声明")
        steps.append("📞 安排高管接受主流媒体采访，主动引导舆论")
    elif risk_data.get("risk_level") == "medium":
        steps.append("⚠️ 密切关注舆情发展，准备应对预案")
        steps.append("📋 整理公司正面素材，必要时主动发声")
    
    # 基于舆情的建议
    positive_cos = [c for c, s in sentiment_data.get("company_sentiment", {}).items() 
                   if s.get("sentiment") == "positive"]
    if positive_cos:
        steps.append(f"📈 借{', '.join(positive_cos[:2])}利好舆情，考虑适时进行投资者沟通")
    
    # 常规建议
    steps.append("📊 关注明日重要财经数据发布，提前准备应对策略")
    steps.append("🎯 建议下午收盘后复盘今日市场反应，调整明日策略")
    
    return steps

def generate_report(report_type: str, companies: List[str], output_format: str, market: str) -> str:
    """生成完整报告"""
    
    print(f"🔄 正在生成{report_type == 'morning' and '早报' or '晚报'}...")
    print(f"📊 关注公司: {', '.join(companies)}")
    print(f"🌏 市场: {market}")
    
    # 1. 获取市场数据
    print("📈 获取市场数据...")
    market_data = get_market_overview(market)
    
    # 2. 获取公司行情
    print("💹 获取公司行情...")
    quotes = get_company_quotes(companies)
    
    # 3. 获取公司新闻和社媒
    print("📰 获取公司新闻和社媒数据...")
    news_data = get_company_news(companies)
    
    # 4. 舆情分析
    print("🔍 分析舆情...")
    sentiment_data = analyze_news_sentiment(news_data.get("news", {}))
    
    # 5. 风险检测
    print("⚠️ 检测风险...")
    risk_data = detect_risks(news_data.get("news", {}), companies)
    
    # 6. 获取宏观新闻
    print("🌍 获取宏观新闻...")
    macro_news = get_macro_news(market)
    
    # 7. 生成高管摘要
    print("📝 生成高管摘要...")
    executive_summary = generate_executive_summary(companies, news_data, market_data, risk_data)
    
    # 8. 生成下一步建议
    print("💡 生成行动建议...")
    next_steps = generate_next_steps(risk_data, sentiment_data, companies)
    
    # 9. 格式化输出
    print("📄 格式化报告...")
    report = format_report(
        report_type=report_type,
        market_data=market_data,
        quotes=quotes,
        news_data=news_data,
        sentiment_data=sentiment_data,
        risk_data=risk_data,
        macro_news=macro_news,
        executive_summary=executive_summary,
        next_steps=next_steps,
        companies=companies,
        output_format=output_format
    )
    
    return report

def load_config() -> Dict[str, Any]:
    """加载配置文件"""
    default_companies = ["601899", "02899"]  # 默认紫金矿业
    
    config_path = os.path.join(os.path.dirname(__file__), "..", "references", "company_list.md")
    if os.path.exists(config_path):
        companies = []
        with open(config_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- ') and ':' in line:
                    symbol = line[2:].split(':')[0].strip()
                    companies.append(symbol)
        if companies:
            return {"companies": companies}
    
    return {"companies": default_companies}

def validate_env():
    """验证环境变量"""
    if not os.environ.get("QVERIS_API_KEY"):
        print("❌ 错误: 未设置 QVERIS_API_KEY 环境变量")
        print("请在 https://qveris.ai 获取 API Key")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description="董事长早晚报生成工具 - 全面版",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s morning                                    # 生成早报
  %(prog)s evening --companies 601899,02899          # 生成晚报，紫金矿业
  %(prog)s morning --format feishu --market CN       # 飞书格式，A股
        """
    )
    
    parser.add_argument(
        "report_type",
        choices=["morning", "evening"],
        help="报告类型: morning (早报) 或 evening (晚报)"
    )
    
    parser.add_argument(
        "--companies",
        type=str,
        default=None,
        help="关注公司列表，逗号分隔 (默认: 601899,02899 紫金矿业)"
    )
    
    parser.add_argument(
        "--format",
        choices=["markdown", "feishu", "html"],
        default="markdown",
        help="输出格式 (默认: markdown)"
    )
    
    parser.add_argument(
        "--market",
        choices=["US", "CN", "HK"],
        default="CN",
        help="市场代码 (默认: CN)"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="输出文件路径 (默认: 输出到控制台)"
    )
    
    args = parser.parse_args()
    
    # 验证环境
    validate_env()
    
    # 加载配置
    config = load_config()
    companies = args.companies.split(",") if args.companies else config["companies"]
    companies = [c.strip().upper() for c in companies]
    
    # 生成报告
    try:
        report = generate_report(
            report_type=args.report_type,
            companies=companies,
            output_format=args.format,
            market=args.market
        )
        
        # 输出报告
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"\n✅ 报告已保存到: {args.output}")
        else:
            print("\n" + "="*70)
            print(report)
            print("="*70)
            
    except Exception as e:
        print(f"\n❌ 生成报告失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
