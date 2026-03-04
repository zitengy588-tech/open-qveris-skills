#!/usr/bin/env python3
"""
Chairman Daily Report - 主控脚本
生成董事长早晚报
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any

# 导入模块
from fetch_market_data import get_market_overview
from fetch_company_news import get_company_news
from analyze_sentiment import analyze_news_sentiment
from risk_detection import detect_risks
from format_output import format_report

def load_config() -> Dict[str, Any]:
    """加载配置文件"""
    default_companies = ["AAPL", "TSLA", "NVDA", "MSFT"]
    
    # 尝试读取公司列表配置文件
    config_path = os.path.join(os.path.dirname(__file__), "..", "references", "company_list.md")
    if os.path.exists(config_path):
        # 解析 markdown 文件提取公司代码
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

def generate_report(report_type: str, companies: List[str], output_format: str, market: str) -> str:
    """
    生成报告
    
    Args:
        report_type: 'morning' 或 'evening'
        companies: 关注公司列表
        output_format: 'markdown', 'feishu', 'html'
        market: 'US', 'CN', 'HK'
    """
    print(f"🔄 正在生成{report_type == 'morning' and '早报' or '晚报'}...")
    print(f"📊 关注公司: {', '.join(companies)}")
    
    # 1. 获取市场概览
    print("📈 获取市场数据...")
    market_data = get_market_overview(market)
    
    # 2. 获取公司新闻
    print("📰 获取公司新闻...")
    news_data = get_company_news(companies)
    
    # 3. 舆情分析
    print("🔍 分析舆情...")
    sentiment_data = analyze_news_sentiment(news_data)
    
    # 4. 风险检测
    print("⚠️ 检测风险...")
    risk_data = detect_risks(news_data, companies)
    
    # 5. 格式化输出
    print("📝 格式化报告...")
    report = format_report(
        report_type=report_type,
        market_data=market_data,
        news_data=news_data,
        sentiment_data=sentiment_data,
        risk_data=risk_data,
        companies=companies,
        output_format=output_format
    )
    
    return report

def main():
    parser = argparse.ArgumentParser(
        description="董事长早晚报生成工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s morning                                    # 生成早报
  %(prog)s evening --companies AAPL,TSLA,NVDA        # 生成晚报，指定公司
  %(prog)s morning --format feishu                   # 生成飞书格式早报
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
        help="关注公司列表，逗号分隔 (默认: AAPL,TSLA,NVDA,MSFT)"
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
        default="US",
        help="市场代码 (默认: US)"
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
            print("\n" + "="*60)
            print(report)
            print("="*60)
            
    except Exception as e:
        print(f"\n❌ 生成报告失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
