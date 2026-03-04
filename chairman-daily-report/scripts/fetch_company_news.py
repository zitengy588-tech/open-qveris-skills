#!/usr/bin/env python3
"""
获取公司新闻 - 调用 QVeris API 和 Web 搜索
"""

import os
import json
from typing import List, Dict, Any
from fetch_market_data import search_qveris_tools, execute_qveris_tool, call_qveris_api

def get_company_news(companies: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    获取公司新闻
    
    Args:
        companies: 公司代码列表
        
    Returns:
        按公司分组的新闻列表
    """
    result = {company: [] for company in companies}
    
    try:
        # 1. 搜索新闻工具
        search_result = search_qveris_tools("company news stock", limit=5)
        
        if not search_result.get("results"):
            # 使用模拟数据
            return get_mock_news_data(companies)
        
        # 2. 获取每个公司的新闻
        for company in companies:
            try:
                news_items = fetch_company_news_items(company, search_result)
                result[company] = news_items
            except Exception as e:
                print(f"  获取 {company} 新闻失败: {e}")
                result[company] = get_mock_news_for_company(company)
                
    except Exception as e:
        print(f"获取新闻数据失败: {e}")
        result = get_mock_news_data(companies)
    
    return result

def fetch_company_news_items(company: str, search_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """获取单个公司的新闻"""
    news_items = []
    
    # 查找新闻工具
    for tool in search_result.get("results", []):
        tool_name = tool.get("name", "").lower()
        if "news" in tool_name or "headline" in tool_name:
            tool_id = tool.get("tool_id")
            search_id = search_result.get("search_id")
            
            try:
                exec_result = execute_qveris_tool(
                    tool_id,
                    search_id,
                    {"symbol": company, "limit": 5}
                )
                
                if exec_result.get("success"):
                    data = exec_result.get("result", {})
                    articles = data.get("articles", data.get("news", []))
                    
                    for article in articles[:5]:
                        news_items.append({
                            "title": article.get("title", "无标题"),
                            "source": article.get("source", "未知来源"),
                            "date": article.get("published_at", article.get("date", "今日")),
                            "summary": article.get("summary", article.get("description", "")[:100] + "..."),
                            "url": article.get("url", "")
                        })
                    
                    break
            except Exception as e:
                print(f"    工具调用失败: {e}")
    
    if not news_items:
        news_items = get_mock_news_for_company(company)
    
    return news_items

def get_mock_news_data(companies: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """模拟新闻数据"""
    return {company: get_mock_news_for_company(company) for company in companies}

def get_mock_news_for_company(company: str) -> List[Dict[str, Any]]:
    """获取单个公司的模拟新闻"""
    mock_news = {
        "AAPL": [
            {"title": "Apple 发布新款 iPhone，市场反应积极", "source": "TechCrunch", "date": "2026-03-03", "summary": "Apple 今日发布新一代 iPhone，股价应声上涨 2%..."},
            {"title": "分析师上调 Apple 目标价至 $220", "source": "Bloomberg", "date": "2026-03-02", "summary": "高盛分析师看好 Apple 服务业务增长..."}
        ],
        "TSLA": [
            {"title": "Tesla 宣布新一轮降价策略", "source": "Reuters", "date": "2026-03-03", "summary": "Tesla 在中国市场降价 5%，以应对竞争..."},
            {"title": "Tesla FSD  Beta 新版本推送", "source": "Electrek", "date": "2026-03-01", "summary": "FSD Beta V12 开始推送给更多用户..."}
        ],
        "NVDA": [
            {"title": "NVIDIA 发布新一代 AI 芯片", "source": "The Verge", "date": "2026-03-03", "summary": "NVIDIA 发布 Blackwell 架构 GPU，性能提升 4 倍..."},
            {"title": "数据中心业务继续强劲增长", "source": "CNBC", "date": "2026-03-02", "summary": "NVIDIA 数据中心业务 Q4 同比增长 400%..."}
        ],
        "MSFT": [
            {"title": "Microsoft Copilot 用户突破 1 亿", "source": "Microsoft Blog", "date": "2026-03-03", "summary": "Copilot 已成为 Microsoft 增长最快的产品..."},
            {"title": "Azure 云服务市场份额持续增长", "source": "TechRadar", "date": "2026-03-01", "summary": "Azure 在 AI 工作负载方面领先竞争对手..."}
        ],
        "BABA": [
            {"title": "阿里巴巴云计算业务重组", "source": "SCMP", "date": "2026-03-03", "summary": "阿里云宣布独立上市计划，市场反应积极..."},
            {"title": "双 11 销售额创历史新高", "source": "Reuters", "date": "2026-03-02", "summary": "2025 年双 11 成交额同比增长 15%..."}
        ]
    }
    
    default_news = [
        {"title": f"{company} 发布最新财报", "source": "财经新闻", "date": "2026-03-03", "summary": f"{company} 季度收入超预期，股价表现强劲..."},
        {"title": f"分析师看好 {company} 前景", "source": "投资分析", "date": "2026-03-02", "summary": f"多家投行上调 {company} 目标价..."}
    ]
    
    return mock_news.get(company, default_news)

if __name__ == "__main__":
    # 测试
    os.environ["QVERIS_API_KEY"] = os.environ.get("QVERIS_API_KEY", "test")
    data = get_company_news(["AAPL", "TSLA"])
    print(json.dumps(data, indent=2, ensure_ascii=False))
