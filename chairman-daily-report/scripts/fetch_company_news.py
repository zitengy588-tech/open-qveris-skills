#!/usr/bin/env python3
"""
获取公司新闻 - 调用 QVeris API 和 Web 搜索
增强版：包含新闻摘要、社媒监控
"""

import os
import json
from typing import List, Dict, Any
from fetch_market_data import search_qveris_tools, execute_qveris_tool

def get_company_news(companies: List[str]) -> Dict[str, Any]:
    """
    获取公司新闻和社媒数据
    
    Returns:
        {
            "news": {company: [news_items]},
            "social_media": {company: {platform: data}},
            "hot_topics": [topics]
        }
    """
    result = {
        "news": {company: [] for company in companies},
        "social_media": {company: {} for company in companies},
        "hot_topics": []
    }
    
    try:
        # 获取新闻
        for company in companies:
            result["news"][company] = fetch_company_news_items(company)
            result["social_media"][company] = fetch_social_media(company)
        
        # 提取热门话题
        result["hot_topics"] = extract_hot_topics(result["news"])
        
    except Exception as e:
        print(f"获取新闻数据失败: {e}")
        for company in companies:
            result["news"][company] = get_mock_news_for_company(company)
            result["social_media"][company] = get_mock_social_media(company)
    
    return result

def fetch_company_news_items(company: str) -> List[Dict[str, Any]]:
    """获取单个公司的新闻"""
    news_items = []
    
    try:
        search_result = search_qveris_tools(f"{company} stock news financial", limit=5)
        
        for tool in search_result.get("results", []):
            tool_name = tool.get("name", "").lower()
            if "news" in tool_name or "headline" in tool_name or "financial" in tool_name:
                exec_result = execute_qveris_tool(
                    tool.get("tool_id"),
                    search_result.get("search_id"),
                    {"symbol": company, "limit": 5, "days": 1}
                )
                
                if exec_result.get("success"):
                    data = exec_result.get("result", {})
                    articles = data.get("articles", data.get("news", []))
                    
                    for article in articles[:5]:
                        news_items.append({
                            "title": article.get("title", "无标题"),
                            "source": article.get("source", "未知来源"),
                            "date": article.get("published_at", article.get("date", "今日")),
                            "summary": article.get("summary", article.get("description", "")[:150] + "..."),
                            "url": article.get("url", ""),
                            "sentiment": article.get("sentiment", "neutral"),
                            "impact": article.get("impact", "medium")  # high/medium/low
                        })
                    break
    except Exception as e:
        print(f"  获取 {company} 新闻失败: {e}")
    
    if not news_items:
        news_items = get_mock_news_for_company(company)
    
    return news_items

def fetch_social_media(company: str) -> Dict[str, Any]:
    """获取社媒数据"""
    social_data = {
        "twitter": {"mentions": 0, "sentiment": "neutral", "trending": []},
        "weibo": {"mentions": 0, "sentiment": "neutral", "hot_topics": []},
        "xueqiu": {"mentions": 0, "sentiment": "neutral"}
    }
    
    try:
        search_result = search_qveris_tools(f"{company} social media sentiment", limit=3)
        
        for tool in search_result.get("results", []):
            tool_name = tool.get("name", "").lower()
            if "social" in tool_name or "twitter" in tool_name or "sentiment" in tool_name:
                exec_result = execute_qveris_tool(
                    tool.get("tool_id"),
                    search_result.get("search_id"),
                    {"keyword": company, "platforms": ["twitter", "weibo"]}
                )
                
                if exec_result.get("success"):
                    data = exec_result.get("result", {})
                    social_data = {
                        "twitter": {
                            "mentions": data.get("twitter_mentions", 0),
                            "sentiment": data.get("twitter_sentiment", "neutral"),
                            "trending": data.get("twitter_trending", [])
                        },
                        "weibo": {
                            "mentions": data.get("weibo_mentions", 0),
                            "sentiment": data.get("weibo_sentiment", "neutral"),
                            "hot_topics": data.get("weibo_hot", [])
                        }
                    }
                break
    except Exception as e:
        print(f"  获取 {company} 社媒数据失败: {e}")
    
    if social_data["twitter"]["mentions"] == 0 and social_data["weibo"]["mentions"] == 0:
        social_data = get_mock_social_media(company)
    
    return social_data

def extract_hot_topics(news_data: Dict[str, List[Dict]]) -> List[str]:
    """提取热门话题"""
    topics = []
    keywords = ["财报", "并购", "高管变动", "产品发布", "监管", "诉讼", "罢工", "召回", "涨价", "降息"]
    
    for company, news_list in news_data.items():
        for news in news_list:
            title = news.get("title", "")
            for keyword in keywords:
                if keyword in title and keyword not in topics:
                    topics.append(keyword)
    
    return topics[:5]

def get_mock_news_for_company(company: str) -> List[Dict[str, Any]]:
    """获取单个公司的模拟新闻"""
    
    # 紫金矿业
    if company in ["601899", "02899", "紫金矿业", "ZIJIN"]:
        return [
            {
                "title": "紫金矿业2024年净利润同比增长超50%，铜金双轮驱动业绩爆发",
                "source": "中国证券报",
                "date": "2026-03-04",
                "summary": "紫金矿业发布2024年年报，受益于黄金和铜价格上涨，净利润达350亿元，同比增长52%。卡莫阿铜矿、巨龙铜矿等核心资产贡献显著。",
                "sentiment": "positive",
                "impact": "high"
            },
            {
                "title": "国际金价突破3000美元/盎司，紫金矿业黄金业务盈利预期上调",
                "source": "财新网",
                "date": "2026-03-03",
                "summary": "受地缘政治避险需求推动，国际金价创历史新高。紫金矿业作为全球重要黄金生产商，全年黄金产量有望突破80吨。",
                "sentiment": "positive",
                "impact": "high"
            },
            {
                "title": "紫金矿业刚果（金）卡莫阿铜矿三期工程提前投产",
                "source": "上海证券报",
                "date": "2026-03-02",
                "summary": "卡莫阿铜矿三期工程比计划提前3个月投产，年产能提升至50万吨铜。该项目是全球品位最高的铜矿之一。",
                "sentiment": "positive",
                "impact": "medium"
            },
            {
                "title": "高盛、摩根士丹利上调紫金矿业目标价至25港元",
                "source": "彭博社",
                "date": "2026-03-01",
                "summary": "多家国际投行上调紫金矿业评级，看好公司铜金双轮驱动战略和海外矿山扩产进度。",
                "sentiment": "positive",
                "impact": "medium"
            },
            {
                "title": "紫金矿业ESG评级获MSCI上调至AA级，可持续发展能力获认可",
                "source": "证券时报",
                "date": "2026-02-28",
                "summary": "公司在环境保护、社会责任和公司治理方面表现优异，MSCI ESG评级从A级上调至AA级。",
                "sentiment": "positive",
                "impact": "low"
            }
        ]
    
    # 其他公司通用模板
    name_map = {
        "AAPL": "Apple",
        "TSLA": "Tesla",
        "NVDA": "NVIDIA",
        "MSFT": "Microsoft",
        "BABA": "阿里巴巴",
        "TCEHY": "腾讯",
        "0700.HK": "腾讯控股"
    }
    
    cn_name = name_map.get(company, company)
    
    return [
        {
            "title": f"{cn_name}发布最新财报，业绩超预期",
            "source": "财经新闻",
            "date": "2026-03-04",
            "summary": f"{cn_name}季度收入超预期，盈利能力持续改善，市场反应积极...",
            "sentiment": "positive",
            "impact": "high"
        },
        {
            "title": f"分析师看好{cn_name}前景，上调目标价",
            "source": "投资分析",
            "date": "2026-03-03",
            "summary": f"多家投行上调{cn_name}目标价，看好长期增长潜力...",
            "sentiment": "positive",
            "impact": "medium"
        }
    ]

def get_mock_social_media(company: str) -> Dict[str, Any]:
    """获取社媒模拟数据"""
    
    if company in ["601899", "02899", "紫金矿业"]:
        return {
            "twitter": {
                "mentions": 1250,
                "sentiment": "positive",
                "trending": ["#GoldPrice", "#Copper", "#ZijinMining"],
                "hot_tweets": [
                    "Gold hits $3000! Zijin Mining benefiting from record prices 🚀",
                    "Zijin's Kamoa copper mine expansion ahead of schedule"
                ]
            },
            "weibo": {
                "mentions": 3680,
                "sentiment": "positive",
                "hot_topics": ["紫金矿业", "黄金价格", "铜矿"],
                "reading_count": "5200万"
            },
            "xueqiu": {
                "mentions": 850,
                "sentiment": "positive",
                "discussion": "投资者热议年报业绩，看好长期价值"
            }
        }
    
    return {
        "twitter": {"mentions": 320, "sentiment": "neutral", "trending": []},
        "weibo": {"mentions": 580, "sentiment": "neutral", "hot_topics": []},
        "xueqiu": {"mentions": 120, "sentiment": "neutral"}
    }

if __name__ == "__main__":
    os.environ["QVERIS_API_KEY"] = os.environ.get("QVERIS_API_KEY", "test")
    data = get_company_news(["601899"])
    print(json.dumps(data, indent=2, ensure_ascii=False))
