#!/usr/bin/env python3
"""
获取市场数据 - 调用 QVeris API
复用 qveris-official skill 的 API 调用方式
"""

import os
import json
import subprocess
from typing import Dict, Any

QVERIS_BASE_URL = "https://qveris.ai/api/v1"

def call_qveris_api(endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    调用 QVeris API
    复用 qveris-official 的调用方式
    """
    import urllib.request
    import ssl
    
    api_key = os.environ.get("QVERIS_API_KEY")
    if not api_key:
        raise ValueError("QVERIS_API_KEY not set")
    
    url = f"{QVERIS_BASE_URL}/{endpoint}"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    data = json.dumps(payload).encode('utf-8')
    
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST"
    )
    
    # 禁用 SSL 验证（开发环境）
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"API Error {e.code}: {error_body}")

def search_qveris_tools(query: str, limit: int = 5) -> Dict[str, Any]:
    """搜索 QVeris 工具"""
    return call_qveris_api("search", {
        "query": query,
        "limit": limit
    })

def execute_qveris_tool(tool_id: str, search_id: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """执行 QVeris 工具"""
    import urllib.request
    import urllib.parse
    import ssl
    import json
    
    api_key = os.environ.get("QVERIS_API_KEY")
    
    # 构建 URL
    url = f"{QVERIS_BASE_URL}/tools/execute?tool_id={urllib.parse.quote(tool_id)}"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    payload = {
        "search_id": search_id,
        "parameters": parameters,
        "max_response_size": 20480
    }
    
    data = json.dumps(payload).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    with urllib.request.urlopen(req, context=ctx, timeout=60) as response:
        return json.loads(response.read().decode('utf-8'))

def get_market_overview(market: str = "US") -> Dict[str, Any]:
    """
    获取市场概览数据
    
    Args:
        market: US (美股), CN (A股), HK (港股)
    """
    result = {
        "market": market,
        "indices": [],
        "sectors": []
    }
    
    try:
        # 1. 搜索股价查询工具
        search_result = search_qveris_tools("stock price index", limit=5)
        
        if not search_result.get("results"):
            # 使用模拟数据
            return get_mock_market_data(market)
        
        # 2. 获取大盘指数
        indices_map = {
            "US": ["^GSPC", "^DJI", "^IXIC"],  # 标普500, 道指, 纳指
            "CN": ["000001.SS", "399001.SZ"],  # 上证指数, 深证成指
            "HK": ["^HSI"]  # 恒生指数
        }
        
        for symbol in indices_map.get(market, ["^GSPC"]):
            try:
                # 查找股价工具
                for tool in search_result.get("results", []):
                    if "stock" in tool.get("name", "").lower() or "price" in tool.get("name", "").lower():
                        tool_id = tool.get("tool_id")
                        search_id = search_result.get("search_id")
                        
                        # 执行工具获取股价
                        exec_result = execute_qveris_tool(
                            tool_id,
                            search_id,
                            {"symbol": symbol}
                        )
                        
                        if exec_result.get("success"):
                            data = exec_result.get("result", {})
                            result["indices"].append({
                                "symbol": symbol,
                                "name": get_index_name(symbol),
                                "price": data.get("price", "N/A"),
                                "change": data.get("change", "N/A"),
                                "change_percent": data.get("change_percent", "N/A")
                            })
                        break
            except Exception as e:
                print(f"  获取 {symbol} 数据失败: {e}")
        
        if not result["indices"]:
            result = get_mock_market_data(market)
            
    except Exception as e:
        print(f"获取市场数据失败: {e}")
        result = get_mock_market_data(market)
    
    return result

def get_index_name(symbol: str) -> str:
    """获取指数名称"""
    names = {
        "^GSPC": "标普 500",
        "^DJI": "道琼斯工业",
        "^IXIC": "纳斯达克综合",
        "000001.SS": "上证指数",
        "399001.SZ": "深证成指",
        "^HSI": "恒生指数"
    }
    return names.get(symbol, symbol)

def get_mock_market_data(market: str) -> Dict[str, Any]:
    """模拟市场数据（API 失败时使用）"""
    mock_data = {
        "US": {
            "indices": [
                {"symbol": "^GSPC", "name": "标普 500", "price": "4,500.00", "change": "+15.30", "change_percent": "+0.34%"},
                {"symbol": "^DJI", "name": "道琼斯工业", "price": "35,000.00", "change": "+120.50", "change_percent": "+0.35%"},
                {"symbol": "^IXIC", "name": "纳斯达克综合", "price": "14,000.00", "change": "+80.20", "change_percent": "+0.58%"}
            ],
            "note": "市场数据为示例（QVeris API 连接失败）"
        },
        "CN": {
            "indices": [
                {"symbol": "000001.SS", "name": "上证指数", "price": "3,050.00", "change": "+10.20", "change_percent": "+0.34%"},
                {"symbol": "399001.SZ", "name": "深证成指", "price": "9,800.00", "change": "+35.50", "change_percent": "+0.36%"}
            ],
            "note": "市场数据为示例（QVeris API 连接失败）"
        },
        "HK": {
            "indices": [
                {"symbol": "^HSI", "name": "恒生指数", "price": "17,000.00", "change": "+85.30", "change_percent": "+0.50%"}
            ],
            "note": "市场数据为示例（QVeris API 连接失败）"
        }
    }
    return mock_data.get(market, mock_data["US"])

if __name__ == "__main__":
    # 测试
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    
    os.environ["QVERIS_API_KEY"] = os.environ.get("QVERIS_API_KEY", "test")
    data = get_market_overview("US")
    print(json.dumps(data, indent=2, ensure_ascii=False))
