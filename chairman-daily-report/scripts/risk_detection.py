#!/usr/bin/env python3
"""
风险检测 - 识别新闻中的潜在风险
"""

from typing import List, Dict, Any

def detect_risks(news_data: Dict[str, List[Dict[str, Any]]], companies: List[str]) -> Dict[str, Any]:
    """
    检测风险
    
    Args:
        news_data: 公司新闻数据
        companies: 关注公司列表
        
    Returns:
        风险检测结果
    """
    result = {
        "risk_level": "low",  # low, medium, high
        "risk_count": 0,
        "risks": [],
        "risk_by_company": {}
    }
    
    # 风险关键词库
    risk_keywords = {
        "high": {
            "诉讼": ["lawsuit", "诉讼", "控告", "索赔", "赔偿"],
            "调查": ["investigation", "probe", "调查", "审查", " subpoena"],
            "财务造假": ["fraud", "accounting irregularities", "财务造假", "假账"],
            "破产": ["bankruptcy", "insolvency", "破产", "资不抵债"],
            "监管处罚": ["SEC fine", "regulatory penalty", "处罚", "罚款", "制裁"]
        },
        "medium": {
            "裁员": ["layoff", "job cut", "裁员", "解雇", "失业"],
            "业绩下滑": ["missed earnings", "profit decline", "业绩下滑", "亏损", "不及预期"],
            "高管离职": ["CEO resignation", "executive departure", "高管离职", "辞职"],
            "产品问题": ["product recall", "defect", "召回", "质量问题", "故障"],
            "竞争压力": ["competition", "market share loss", "竞争", "份额下降"]
        },
        "low": {
            "股价波动": ["volatile", "stock drop", "股价下跌", "暴跌"],
            "评级下调": ["downgrade", "rating cut", "下调评级", "减持"],
            "分析师看空": ["bearish", "sell rating", "看空", "卖出评级"]
        }
    }
    
    for company in companies:
        company_news = news_data.get(company, [])
        company_risks = []
        
        for news in company_news:
            title = news.get("title", "").lower()
            summary = news.get("summary", "").lower()
            text = title + " " + summary
            
            # 检测高风险
            for risk_type, keywords in risk_keywords["high"].items():
                if any(kw in text for kw in keywords):
                    company_risks.append({
                        "level": "high",
                        "type": risk_type,
                        "title": news.get("title"),
                        "source": news.get("source"),
                        "company": company
                    })
                    break
            
            # 检测中风险
            for risk_type, keywords in risk_keywords["medium"].items():
                if any(kw in text for kw in keywords):
                    company_risks.append({
                        "level": "medium",
                        "type": risk_type,
                        "title": news.get("title"),
                        "source": news.get("source"),
                        "company": company
                    })
                    break
            
            # 检测低风险
            for risk_type, keywords in risk_keywords["low"].items():
                if any(kw in text for kw in keywords):
                    company_risks.append({
                        "level": "low",
                        "type": risk_type,
                        "title": news.get("title"),
                        "source": news.get("source"),
                        "company": company
                    })
                    break
        
        result["risk_by_company"][company] = company_risks
        result["risks"].extend(company_risks)
    
    # 计算整体风险等级
    high_risks = len([r for r in result["risks"] if r["level"] == "high"])
    medium_risks = len([r for r in result["risks"] if r["level"] == "medium"])
    
    if high_risks > 0:
        result["risk_level"] = "high"
    elif medium_risks > 0:
        result["risk_level"] = "medium"
    
    result["risk_count"] = len(result["risks"])
    
    return result

def get_pr_recommendation(risk_data: Dict[str, Any]) -> str:
    """生成公关建议"""
    level = risk_data.get("risk_level", "low")
    
    recommendations = {
        "high": "⚠️ **高风险警告**：检测到重大风险事件，建议立即启动危机公关预案，准备官方声明，安排高管对外沟通。",
        "medium": "📢 **中度关注**：存在一定风险，建议密切关注舆情发展，准备应对预案，必要时主动发布正面信息引导舆论。",
        "low": "✅ **风险可控**：整体风险较低，保持正常舆情监控即可。"
    }
    
    return recommendations.get(level, recommendations["low"])

if __name__ == "__main__":
    # 测试
    test_data = {
        "AAPL": [
            {"title": "Apple 发布新款 iPhone，市场反应积极", "source": "TechCrunch", "summary": "Apple 今日发布新一代 iPhone..."},
        ],
        "TSLA": [
            {"title": "Tesla 面临 SEC 调查", "source": "Reuters", "summary": "SEC 正在调查 Tesla 的自动驾驶声明..."},
        ]
    }
    
    result = detect_risks(test_data, ["AAPL", "TSLA"])
    import json
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("\n公关建议:")
    print(get_pr_recommendation(result))
