#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://qveris.ai/api/v1";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const EVOLUTION_DIR = path.join(SKILL_ROOT, ".evolution");
const EVOLUTION_FILE = path.join(EVOLUTION_DIR, "tool-evolution.json");
const EVOLUTION_VERSION = 1;
const MAX_CAPABILITY_BUCKETS = 8;
const MAX_TOOLS_PER_CAPABILITY = 30;
const MAX_MARKETS_PER_TOOL = 6;

const CAPABILITY_QUERIES = {
  quote: "real-time stock quote and historical OHLCV data API",
  fundamentals: "company financial statements and valuation metrics API",
  technicals: "technical indicators RSI MACD moving average API",
  sentiment: "stock news sentiment and market headlines API",
  x_sentiment: "X Twitter stock sentiment API by ticker",
};

const CN_HK_QUERY_HINTS = {
  quote: "ths_ifind.real_time_quotation China and Hong Kong stock real-time quotation API",
  fundamentals:
    "ths_ifind.financial_statements ths_ifind.company_basics China and Hong Kong stock financial statements and company basics API",
  technicals: "ths_ifind.history_quotation China and Hong Kong stock historical quotation API",
};

const X_SENTIMENT_TOOL_PREFIXES = [
  "x_developer.2.tweets.search.recent",
  "qveris_social.x_domain_new_posts",
  "qveris_social.x_domain_hot_topics",
  "qveris_social.x_domain_hot_events",
];
const CAIDAZI_TOOL_PREFIXES = [
  "caidazi.news.query",
  "caidazi.report.query",
  "caidazi.search.hybrid.list",
  "caidazi.search.hybrid_v2.query",
];

const COMPANY_SYMBOL_ALIASES = {
  特变电工: { symbol: "600089.SH", market: "CN" },
  英伟达: { symbol: "NVDA", market: "US" },
  腾讯: { symbol: "0700.HK", market: "HK" },
  腾讯控股: { symbol: "0700.HK", market: "HK" },
  贵州茅台: { symbol: "600519.SH", market: "CN" },
};

function redactSecrets(text) {
  if (!text) return text;
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, "Bearer [REDACTED]")
    .replace(/QVERIS_API_KEY\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, "QVERIS_API_KEY=[REDACTED]")
    .replace(/("?(?:qveris_api_key|authorization)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi, "$1[REDACTED]")
    .replace(/([?&](?:api_key|token|access_token|authorization)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}/g, "[REDACTED_TOKEN]");
}

function isoNow() {
  return new Date().toISOString();
}

function getApiKey() {
  const key = process.env.QVERIS_API_KEY;
  if (!key) {
    console.error("Error: QVERIS_API_KEY environment variable is required.");
    process.exit(1);
  }
  return key;
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

function emptyEvolutionState() {
  return {
    version: EVOLUTION_VERSION,
    updated_at: isoNow(),
    capability_buckets: {},
  };
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function sanitizeToolRecord(toolId, record) {
  const markets = Array.isArray(record?.markets)
    ? [...new Set(record.markets.filter((x) => typeof x === "string"))].slice(0, MAX_MARKETS_PER_TOOL)
    : [];
  return {
    tool_id: String(toolId),
    provider: typeof record?.provider === "string" ? record.provider : pickProvider(toolId),
    first_seen_at: typeof record?.first_seen_at === "string" ? record.first_seen_at : isoNow(),
    last_success_at: typeof record?.last_success_at === "string" ? record.last_success_at : null,
    success_count: Math.max(0, toInt(record?.success_count, 0)),
    fail_count: Math.max(0, toInt(record?.fail_count, 0)),
    avg_elapsed_ms: Math.max(0, toInt(record?.avg_elapsed_ms, 0)),
    markets,
  };
}

function sanitizeEvolutionState(state) {
  const safe = emptyEvolutionState();
  if (!state || typeof state !== "object" || typeof state.capability_buckets !== "object") {
    return safe;
  }
  const capabilities = Object.keys(state.capability_buckets).slice(0, MAX_CAPABILITY_BUCKETS);
  for (const capability of capabilities) {
    const bucket = state.capability_buckets[capability];
    if (!bucket || typeof bucket !== "object" || typeof bucket.tools !== "object") continue;
    const cleanedTools = {};
    const toolIds = Object.keys(bucket.tools).slice(0, MAX_TOOLS_PER_CAPABILITY * 3);
    for (const toolId of toolIds) {
      if (!toolId || typeof toolId !== "string") continue;
      cleanedTools[toolId] = sanitizeToolRecord(toolId, bucket.tools[toolId]);
    }
    const ranked = Object.values(cleanedTools)
      .sort((a, b) => scoreEvolutionRecord(b, "GLOBAL") - scoreEvolutionRecord(a, "GLOBAL"))
      .slice(0, MAX_TOOLS_PER_CAPABILITY);
    safe.capability_buckets[capability] = {
      tools: Object.fromEntries(ranked.map((x) => [x.tool_id, x])),
      priority_queue: ranked.map((x) => x.tool_id),
    };
  }
  safe.updated_at = isoNow();
  return safe;
}

function ensureBucket(state, capability) {
  if (!state.capability_buckets[capability]) {
    state.capability_buckets[capability] = {
      tools: {},
      priority_queue: [],
    };
  }
  return state.capability_buckets[capability];
}

async function loadEvolutionState() {
  try {
    const content = await fs.readFile(EVOLUTION_FILE, "utf8");
    const parsed = JSON.parse(content);
    return sanitizeEvolutionState(parsed);
  } catch {
    return emptyEvolutionState();
  }
}

async function saveEvolutionState(state) {
  const payload = sanitizeEvolutionState(state);
  await fs.mkdir(EVOLUTION_DIR, { recursive: true });
  await fs.writeFile(EVOLUTION_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function pickProvider(toolId) {
  if (!toolId) return "unknown";
  const first = String(toolId).split(".")[0];
  return first || "unknown";
}

function scoreEvolutionRecord(record, market) {
  const success = Number(record.success_count || 0);
  const fail = Number(record.fail_count || 0);
  const ratio = (success + 1) / (success + fail + 1);
  const elapsed = Number(record.avg_elapsed_ms || 10000);
  const speedScore = elapsed > 0 ? 1 / (1 + elapsed) : 0;
  const marketMatch = Array.isArray(record.markets) && record.markets.includes(market) ? 0.1 : 0;
  return ratio * 0.85 + speedScore * 0.05 + marketMatch;
}

function refreshBucketPriority(state, capability, market) {
  const bucket = ensureBucket(state, capability);
  const ranked = Object.values(bucket.tools)
    .sort((a, b) => scoreEvolutionRecord(b, market) - scoreEvolutionRecord(a, market))
    .slice(0, MAX_TOOLS_PER_CAPABILITY);
  bucket.tools = Object.fromEntries(ranked.map((x) => [x.tool_id, x]));
  bucket.priority_queue = ranked.map((x) => x.tool_id);
}

function getEvolutionCandidates(state, capability, market) {
  const bucket = ensureBucket(state, capability);
  refreshBucketPriority(state, capability, market);
  const candidates = [];
  for (const toolId of bucket.priority_queue.slice(0, 5)) {
    const record = bucket.tools[toolId];
    if (!record) continue;
    candidates.push({
      tool_id: record.tool_id,
      stats: {
        success_rate: (record.success_count + 1) / (record.success_count + record.fail_count + 1),
        avg_execution_time_ms: record.avg_elapsed_ms || 9999,
      },
      _fromEvolution: true,
    });
  }
  return candidates;
}

function updateEvolutionOnAttempt(state, meta) {
  const {
    capability,
    market,
    toolId,
    elapsedMs,
    success,
    newlyLearnedCollector,
  } = meta;
  if (!toolId || !capability) return;
  const bucket = ensureBucket(state, capability);
  if (!bucket.tools[toolId]) {
    bucket.tools[toolId] = {
      tool_id: toolId,
      provider: pickProvider(toolId),
      first_seen_at: isoNow(),
      last_success_at: null,
      success_count: 0,
      fail_count: 0,
      avg_elapsed_ms: 0,
      markets: [],
    };
  }
  const record = bucket.tools[toolId];
  if (!record.markets.includes(market)) record.markets.push(market);

  if (success) {
    record.success_count += 1;
    record.last_success_at = isoNow();
    const prev = Number(record.avg_elapsed_ms || 0);
    const n = record.success_count;
    record.avg_elapsed_ms = n === 1 ? elapsedMs : Math.round((prev * (n - 1) + elapsedMs) / n);
    if (newlyLearnedCollector && n === 1) {
      newlyLearnedCollector.push(toolId);
    }
  } else {
    record.fail_count += 1;
  }
  refreshBucketPriority(state, capability, market);
}

async function searchTools(query, limit, timeoutMs) {
  const apiKey = getApiKey();
  const { signal, cleanup } = timeoutSignal(timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Search failed (${res.status}): ${await res.text()}`);
    }
    return await res.json();
  } finally {
    cleanup();
  }
}

async function executeTool(toolId, searchId, parameters, maxResponseSize, timeoutMs) {
  const apiKey = getApiKey();
  const { signal, cleanup } = timeoutSignal(timeoutMs);
  try {
    const url = new URL(`${BASE_URL}/tools/execute`);
    url.searchParams.set("tool_id", toolId);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search_id: searchId,
        parameters,
        max_response_size: maxResponseSize,
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Execute failed (${res.status}): ${await res.text()}`);
    }
    return await res.json();
  } finally {
    cleanup();
  }
}

function isToolCallSuccessful(result) {
  if (!result || typeof result !== "object") return false;
  if (result.success === false) return false;
  const payload = result?.result ?? result;
  const data = payload?.data ?? payload;
  if (data?.status === "error") return false;
  if (typeof data?.code === "number" && data.code >= 400) return false;
  if (typeof data?.["Error Message"] === "string") return false;
  if (typeof data?.Information === "string" && data.Information.toLowerCase().includes("burst pattern")) return false;
  return true;
}

function scoreTool(tool) {
  const stats = tool?.stats || {};
  const successRate = toNumber(stats.success_rate) ?? 0;
  const latency = toNumber(stats.avg_execution_time_ms);
  const latencyScore = latency && latency > 0 ? 1 / (1 + latency) : 0;
  const hasExamples = tool?.examples?.sample_parameters ? 0.03 : 0;
  return successRate * 0.8 + latencyScore * 0.17 + hasExamples;
}

function rankTools(results) {
  return [...(results || [])]
    .sort((a, b) => scoreTool(b) - scoreTool(a))
    .map((tool) => ({
      ...tool,
      _score: scoreTool(tool),
    }));
}

function summarizeTool(tool) {
  if (!tool || typeof tool !== "object") return null;
  return {
    tool_id: tool.tool_id ?? null,
    name: tool.name ?? null,
    stats: tool.stats ?? null,
    _fromEvolution: Boolean(tool._fromEvolution),
  };
}

function hasCjk(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ""));
}

function normalizeAliasKey(value) {
  return String(value || "")
    .trim()
    .replace(/[（(]\s*[0-9A-Za-z._-]+\s*[)）]/g, "")
    .replace(/\s+/g, "");
}

function extractTickerFromText(value) {
  const raw = String(value || "").trim();
  const withSuffix = raw.match(/([0-9]{4,6}\.(?:HK|SH|SZ|SS))/i);
  if (withSuffix?.[1]) return withSuffix[1].toUpperCase();
  const sixDigits = raw.match(/\b([0-9]{6})\b/);
  if (sixDigits?.[1]) return sixDigits[1];
  const fourDigits = raw.match(/\b([0-9]{4})\b/);
  if (fourDigits?.[1]) return fourDigits[1];
  return null;
}

function inferMarketFromSymbol(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "GLOBAL";
  if (raw.endsWith(".HK") || /^[0-9]{4,5}$/.test(raw)) return "HK";
  if (/\.(SH|SZ|SS)$/.test(raw) || /^[0-9]{6}$/.test(raw)) return "CN";
  if (raw.endsWith(".US") || /^[A-Z]{1,6}$/.test(raw)) return "US";
  if (hasCjk(raw)) return "CN";
  return "GLOBAL";
}

function resolveRequestedSymbol(input, preferredMarket = "GLOBAL") {
  const original = String(input || "").trim();
  const aliasKey = normalizeAliasKey(original);
  const alias = COMPANY_SYMBOL_ALIASES[aliasKey];
  if (alias) {
    return {
      original,
      symbol: alias.symbol,
      market: preferredMarket !== "GLOBAL" ? preferredMarket : alias.market,
      resolvedBy: "alias",
    };
  }

  const extractedTicker = extractTickerFromText(original);
  if (extractedTicker) {
    const market = preferredMarket !== "GLOBAL" ? preferredMarket : inferMarketFromSymbol(extractedTicker);
    return {
      original,
      symbol: extractedTicker,
      market,
      resolvedBy: "ticker-extract",
    };
  }

  const inferred = preferredMarket !== "GLOBAL" ? preferredMarket : inferMarketFromSymbol(original);
  return {
    original,
    symbol: original,
    market: inferred,
    resolvedBy: hasCjk(original) ? "cjk-default" : "input",
  };
}

function prioritizeCandidatesByMarket(candidates, capability, market) {
  const list = [...(candidates || [])];
  const isCnHkCore = ["CN", "HK"].includes(market) && ["quote", "fundamentals", "technicals"].includes(capability);
  if (!isCnHkCore) return list;
  const native = list.filter((t) => String(t?.tool_id || "").startsWith("ths_ifind."));
  if (native.length === 0) return list;
  const others = list.filter((t) => !String(t?.tool_id || "").startsWith("ths_ifind."));
  return [...native, ...others];
}

function isCaidaziTool(toolId) {
  const id = String(toolId || "");
  return CAIDAZI_TOOL_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function caidaziPriority(toolId) {
  const id = String(toolId || "");
  if (id.startsWith("caidazi.search.hybrid_v2.query")) return 4;
  if (id.startsWith("caidazi.news.query")) return 3;
  if (id.startsWith("caidazi.report.query")) return 2;
  if (id.startsWith("caidazi.search.hybrid.list")) return 1;
  return 0;
}

function thsFundamentalPriority(toolId) {
  const id = String(toolId || "");
  if (id.startsWith("ths_ifind.financial_statements")) return 5;
  if (id.startsWith("ths_ifind.income_statement")) return 4;
  if (id.startsWith("ths_ifind.balance_sheet")) return 3;
  if (id.startsWith("ths_ifind.cash_flow_statement")) return 2;
  if (id.startsWith("ths_ifind.company_basics")) return 1;
  return 0;
}

function isToolCompatibleForCapability(toolId, capability, market) {
  const id = String(toolId || "");
  if (!id) return false;
  if (capability === "quote") {
    if (id.startsWith("ths_ifind.") && !id.startsWith("ths_ifind.real_time_quotation")) return false;
    return true;
  }
  if (capability === "fundamentals") {
    if (
      id.startsWith("ths_ifind.") &&
      !id.startsWith("ths_ifind.company_basics") &&
      !id.startsWith("ths_ifind.financial_statements") &&
      !id.startsWith("ths_ifind.income_statement") &&
      !id.startsWith("ths_ifind.balance_sheet") &&
      !id.startsWith("ths_ifind.cash_flow_statement")
    ) {
      return false;
    }
    return true;
  }
  if (capability === "technicals") {
    if (id.startsWith("ths_ifind.") && !id.startsWith("ths_ifind.history_quotation")) return false;
    return true;
  }
  if (capability === "x_sentiment") {
    return X_SENTIMENT_TOOL_PREFIXES.some((prefix) => id.startsWith(prefix));
  }
  if (capability === "sentiment") {
    return !id.startsWith("x_developer.");
  }
  if (["CN", "HK"].includes(market) && ["quote", "fundamentals", "technicals"].includes(capability)) {
    if (id.startsWith("ths_ifind.")) return true;
  }
  return true;
}

function marketCapabilityBoost(tool, capability, market) {
  const id = String(tool?.tool_id || "");
  if (["CN", "HK"].includes(market) && ["quote", "fundamentals", "technicals"].includes(capability)) {
    if (id.startsWith("ths_ifind.")) return 0.3;
    if (id.startsWith("alphavantage.") || id.startsWith("twelvedata.") || id.startsWith("finnhub_io_api.")) return -0.08;
  }
  if (["CN", "HK"].includes(market) && capability === "fundamentals") {
    if (id.startsWith("ths_ifind.financial_statements") || id.startsWith("ths_ifind.income_statement")) return 0.2;
    if (id.startsWith("ths_ifind.balance_sheet")) return 0.14;
    if (id.startsWith("ths_ifind.cash_flow_statement")) return 0.1;
    if (id.startsWith("ths_ifind.company_basics")) return 0.08;
  }
  if (market === "US" && ["quote", "fundamentals", "technicals"].includes(capability)) {
    if (id.startsWith("alphavantage.") || id.startsWith("twelvedata.") || id.startsWith("finnhub_io_api.")) return 0.08;
  }
  if (["CN", "HK"].includes(market) && capability === "sentiment") {
    if (isCaidaziTool(id)) return 0.28;
    if (id.startsWith("finnhub.") || id.startsWith("alphavantage.")) return -0.05;
  }
  return 0;
}

function normalizeSymbols(input, market) {
  const raw = (input || "").trim();
  if (!raw) return [];
  const candidates = new Set([raw.toUpperCase()]);
  const upper = raw.toUpperCase();

  if (market === "US") {
    candidates.add(upper.replace(/\.US$/, ""));
    candidates.add(`${upper.replace(/\.US$/, "")}.US`);
  } else if (market === "HK") {
    const core = upper.replace(/\.HK$/, "").replace(/^0+/, "") || "0";
    candidates.add(`${core}.HK`);
    candidates.add(`${core.padStart(4, "0")}.HK`);
    candidates.add(core.padStart(4, "0"));
  } else if (market === "CN") {
    const core = upper.replace(/\.(SS|SH|SZ)$/, "");
    candidates.add(`${core}.SS`);
    candidates.add(`${core}.SH`);
    candidates.add(`${core}.SZ`);
  } else {
    candidates.add(`${upper}.US`);
    if (/^\d+$/.test(upper)) {
      candidates.add(`${upper}.HK`);
      candidates.add(`${upper}.SS`);
      candidates.add(`${upper}.SZ`);
    }
  }

  return [...candidates];
}

function toThsCode(symbol, market) {
  const upper = (symbol || "").toUpperCase();
  if (upper.includes(".")) return upper;
  if (market === "CN") {
    if (upper.startsWith("6")) return `${upper}.SH`;
    return `${upper}.SZ`;
  }
  if (market === "HK") {
    return `${upper.replace(/^0+/, "").padStart(4, "0")}.HK`;
  }
  return upper;
}

function extractJSONFromTruncatedContent(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseDateLike(value) {
  if (!value) return null;
  if (typeof value === "number") {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : `${value}T00:00:00Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isStale(value, days = 5) {
  const date = parseDateLike(value);
  if (!date) return false;
  const diffMs = Date.now() - date.getTime();
  return diffMs > days * 24 * 60 * 60 * 1000;
}

function pickQuoteData(raw) {
  const data = raw?.result?.data || raw?.data || raw || {};
  if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
    const row = data[0][0];
    return {
      symbol: row.thscode ?? null,
      price: toNumber(row.latest),
      open: toNumber(row.open),
      high: toNumber(row.high),
      low: toNumber(row.low),
      volume: toNumber(row.volume),
      percentChange: toNumber(row.changeRatio),
      timestamp: row.time ?? row.tradeDate ?? null,
      raw: row,
    };
  }
  return {
    symbol: data.symbol ?? data.Symbol ?? null,
    price: toNumber(data.close ?? data.price ?? data.latestPrice),
    open: toNumber(data.open),
    high: toNumber(data.high),
    low: toNumber(data.low),
    volume: toNumber(data.volume),
    percentChange: toNumber(data.percent_change ?? data.changePercent),
    timestamp: data.datetime ?? data.timestamp ?? data["07. latest trading day"] ?? null,
    raw: data,
  };
}

function pickFundamentalData(raw) {
  const data = raw?.result?.data || raw?.data || raw || {};
  if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
    const row = data[0][0];
    const statementType = row.statement_type || row.statementType || null;
    const period = row.time || row.end_date || row.report_date || null;
    return {
      symbol: row.ths_thscode_stock ?? row.thscode ?? null,
      name: row.ths_corp_cn_name_stock ?? null,
      marketCap: null,
      pe: null,
      forwardPe: null,
      pb: null,
      ps: null,
      profitMargin: null,
      revenueGrowthYoy: null,
      earningsGrowthYoy: null,
      week52High: null,
      week52Low: null,
      latestQuarter: period,
      statementType,
      reportPeriod: period,
      revenue: toNumber(row.ths_revenue_stock ?? row.ths_operating_total_revenue_stock),
      netProfit: toNumber(row.ths_np_atoopc_stock ?? row.ths_np_stock),
      totalAssets: toNumber(row.ths_total_assets_stock),
      totalLiabilities: toNumber(row.ths_total_liab_stock),
      operatingCashflow: toNumber(row.ths_ncf_from_oa_stock),
      raw: row,
    };
  }
  return {
    symbol: data.Symbol ?? data.symbol ?? null,
    name: data.Name ?? data.name ?? null,
    marketCap: toNumber(data.MarketCapitalization ?? data.marketCap),
    pe: toNumber(data.PERatio ?? data.pe ?? data.TrailingPE),
    forwardPe: toNumber(data.ForwardPE),
    pb: toNumber(data.PriceToBookRatio),
    ps: toNumber(data.PriceToSalesRatioTTM),
    profitMargin: toNumber(data.ProfitMargin),
    revenueGrowthYoy: toNumber(data.QuarterlyRevenueGrowthYOY),
    earningsGrowthYoy: toNumber(data.QuarterlyEarningsGrowthYOY),
    week52High: toNumber(data["52WeekHigh"] ?? data.fifty_two_week?.high),
    week52Low: toNumber(data["52WeekLow"] ?? data.fifty_two_week?.low),
    latestQuarter: data.LatestQuarter ?? null,
    raw: data,
  };
}

function pickTechnicalData(raw) {
  const result = raw?.result || raw || {};
  const data = result?.data || result;
  if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
    const rows = data[0];
    const row = rows[rows.length - 1];
    return {
      latestDate: row.time ?? null,
      rsi: null,
      close: toNumber(row.close),
      changeRatio: toNumber(row.changeRatio),
      raw: row,
    };
  }
  if (data?.["Technical Analysis: RSI"]) {
    const entries = Object.entries(data["Technical Analysis: RSI"]);
    if (entries.length > 0) {
      const [date, value] = entries[0];
      return {
        latestDate: date,
        rsi: toNumber(value?.RSI),
        raw: data,
      };
    }
  }
  return {
    latestDate: null,
    rsi: null,
    raw: data,
  };
}

function pickSentimentData(raw) {
  const payload = raw?.result || raw || {};
  const data = payload?.data || payload;
  const content = data?.truncated_content ? extractJSONFromTruncatedContent(data.truncated_content) : data;
  const hits = content?.data?.hits || content?.hits || [];
  if (Array.isArray(hits)) {
    const latest = hits[0]?.source || hits[0] || null;
    const sentimentScore = latest?.newsSentiment?.[0]?.sentimentScore ?? latest?.weChatSentiment?.[0]?.sentimentScore ?? null;
    const sourceLabel = latest?.type || latest?.sourceName || latest?.siteName || null;
    return {
      itemCount: hits.length,
      latestHeadline: latest?.title ?? null,
      latestTime: latest?.publishTime ?? latest?.effectiveTime ?? null,
      latestTickerSentiment: sentimentScore,
      sourceLabel,
      fullContentFileUrl: data?.full_content_file_url ?? null,
      raw: content,
    };
  }
  if (Array.isArray(content)) {
    const latest = content[0] || null;
    return {
      itemCount: content.length,
      latestHeadline: latest?.headline ?? null,
      latestTime: latest?.datetime ?? null,
      latestTickerSentiment: null,
      fullContentFileUrl: data?.full_content_file_url ?? null,
      raw: content,
    };
  }
  const feed = content?.feed || [];
  const latest = feed[0] || null;
  return {
    itemCount: toNumber(content?.items) ?? feed.length,
    latestHeadline: latest?.title ?? null,
    latestTime: latest?.time_published ?? null,
    latestTickerSentiment: latest?.ticker_sentiment?.[0]?.ticker_sentiment_label ?? null,
    fullContentFileUrl: data?.full_content_file_url ?? null,
    raw: content,
  };
}

function pickXSentimentData(raw) {
  const payload = raw?.result || raw || {};
  const data = payload?.data ?? payload;
  const content = data?.truncated_content ? extractJSONFromTruncatedContent(data.truncated_content) : data;

  let posts = [];
  if (Array.isArray(content)) posts = content;
  else if (Array.isArray(content?.data)) posts = content.data;
  else if (Array.isArray(content?.posts)) posts = content.posts;
  else if (Array.isArray(content?.results)) posts = content.results;

  const first = posts[0] || null;
  return {
    itemCount: posts.length || toNumber(content?.total) || 0,
    topPostText: first?.text ?? first?.full_text ?? first?.title ?? first?.headline ?? null,
    topPostTime: first?.created_at ?? first?.time ?? first?.datetime ?? null,
    sourceMode: Array.isArray(content) ? "fallback" : "direct",
    fullContentFileUrl: data?.full_content_file_url ?? null,
    raw: content,
  };
}

async function executeWithFallback(candidates, searchId, paramBuilder, options, executionMeta = {}) {
  const attempts = [];
  const maxAttempts = options.maxAttemptsPerPhase || 3;
  const successValidator = executionMeta?.successValidator;
  for (const tool of candidates.slice(0, maxAttempts)) {
    const params = paramBuilder(tool);
    try {
      const sid = searchId;
      const startedAt = Date.now();
      const result = await executeTool(tool.tool_id, sid, params, options.maxSize, options.timeoutMs);
      const ok = isToolCallSuccessful(result);
      const validatedOk = ok && (typeof successValidator === "function" ? successValidator(result) : true);
      const elapsed = Date.now() - startedAt;
      attempts.push({ toolId: tool.tool_id, ok: validatedOk, params, elapsed_ms: elapsed });
      if (options.evolutionState) {
        updateEvolutionOnAttempt(options.evolutionState, {
          ...executionMeta,
          toolId: tool.tool_id,
          elapsedMs: elapsed,
          success: validatedOk,
          newlyLearnedCollector: options.newlyLearnedTools,
        });
      }
      if (validatedOk) {
        return { success: true, selectedTool: summarizeTool(tool), attempts, successfulResult: result };
      }
    } catch (error) {
      attempts.push({ toolId: tool.tool_id, ok: false, error: redactSecrets(error.message), params });
      if (options.evolutionState) {
        updateEvolutionOnAttempt(options.evolutionState, {
          ...executionMeta,
          toolId: tool.tool_id,
          elapsedMs: 0,
          success: false,
          newlyLearnedCollector: options.newlyLearnedTools,
        });
      }
    }
  }
  return { success: false, selectedTool: null, attempts };
}

function summarizeQuality(payload) {
  const warnings = [];
  const quote = payload.quote?.parsed;
  const fundamentals = payload.fundamentals?.parsed;
  const technicals = payload.technicals?.parsed;
  const sentiment = payload.sentiment?.parsed;

  if (!quote?.price) warnings.push("行情缺少最新价格字段");
  if (!fundamentals?.pe && !fundamentals?.marketCap) warnings.push("基本面关键估值字段缺失");
  if (technicals && technicals.rsi == null && technicals.changeRatio == null) warnings.push("技术指标缺少 RSI/趋势字段");
  if (sentiment && !sentiment.itemCount) warnings.push("情绪数据缺少新闻条目");

  if (quote?.timestamp && typeof quote.timestamp === "string" && quote.timestamp.length < 8) {
    warnings.push("行情时间戳格式异常");
  }
  if (isStale(quote?.timestamp, 5)) warnings.push("行情数据可能已过期（超过 5 天）");
  if (isStale(fundamentals?.latestQuarter, 220)) warnings.push("基本面季度数据较旧");

  if (quote?.price != null && fundamentals?.week52High != null && quote.price > fundamentals.week52High * 1.08) {
    warnings.push("行情价格明显高于 52 周高点，可能存在跨源不一致");
  }
  if (quote?.price != null && fundamentals?.week52Low != null && quote.price < fundamentals.week52Low * 0.92) {
    warnings.push("行情价格明显低于 52 周低点，可能存在跨源不一致");
  }

  let confidence = "high";
  if (warnings.length >= 2) confidence = "medium";
  if (warnings.length >= 4) confidence = "low";
  return { confidence, warnings };
}

function isParsedDataUsable(capability, parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  if (capability === "quote") {
    return parsed.price != null || parsed.symbol != null || parsed.timestamp != null;
  }
  if (capability === "fundamentals") {
    return (
      parsed.name != null ||
      parsed.marketCap != null ||
      parsed.pe != null ||
      parsed.revenue != null ||
      parsed.netProfit != null ||
      parsed.totalAssets != null ||
      parsed.operatingCashflow != null
    );
  }
  if (capability === "technicals") {
    return parsed.rsi != null || parsed.changeRatio != null || parsed.close != null;
  }
  if (capability === "sentiment") {
    return parsed.itemCount != null;
  }
  if (capability === "x_sentiment") {
    return parsed.itemCount != null;
  }
  return true;
}

function formatMarkdown(result) {
  const { symbol, market, mode, data, quality, evolution } = result;
  const q = data.quote?.parsed || {};
  const f = data.fundamentals?.parsed || {};
  const t = data.technicals?.parsed || {};
  const s = data.sentiment?.parsed || {};
  const x = data.x_sentiment?.parsed || {};
  const lines = [];

  lines.push(`# Stock Copilot Pro Report: ${symbol}`);
  lines.push("");
  lines.push("## summary");
  lines.push(`- Market: ${market}`);
  lines.push(`- Mode: ${mode}`);
  lines.push(`- Confidence: ${quality.confidence}`);
  lines.push(`- Latest Price: ${q.price ?? "N/A"}`);
  lines.push(`- Change(%): ${q.percentChange ?? "N/A"}`);
  lines.push("");

  lines.push("## fundamentals");
  lines.push(`- Name: ${f.name ?? "N/A"}`);
  lines.push(`- Market Cap: ${f.marketCap ?? "N/A"}`);
  lines.push(`- PE / Forward PE: ${f.pe ?? "N/A"} / ${f.forwardPe ?? "N/A"}`);
  lines.push(`- Profit Margin: ${f.profitMargin ?? "N/A"}`);
  lines.push(`- Revenue Growth YoY: ${f.revenueGrowthYoy ?? "N/A"}`);
  lines.push(`- 52W Range: ${f.week52Low ?? "N/A"} - ${f.week52High ?? "N/A"}`);
  lines.push(`- Financial Report Period: ${f.reportPeriod ?? f.latestQuarter ?? "N/A"}`);
  lines.push(`- Revenue / Net Profit: ${f.revenue ?? "N/A"} / ${f.netProfit ?? "N/A"}`);
  lines.push(`- Total Assets / Total Liabilities: ${f.totalAssets ?? "N/A"} / ${f.totalLiabilities ?? "N/A"}`);
  lines.push(`- Operating Cashflow: ${f.operatingCashflow ?? "N/A"}`);
  lines.push("");

  lines.push("## technicals");
  lines.push(`- Latest RSI: ${t.rsi ?? "N/A"} (${t.latestDate ?? "N/A"})`);
  if (t.rsi != null) {
    lines.push(`- RSI View: ${t.rsi > 70 ? "overbought risk" : t.rsi < 30 ? "oversold rebound zone" : "neutral momentum"}`);
  }
  lines.push("");

  lines.push("## sentiment");
  lines.push(`- News Items: ${s.itemCount ?? "N/A"}`);
  lines.push(`- Latest Headline: ${s.latestHeadline ?? "N/A"}`);
  lines.push(`- Latest Ticker Sentiment: ${s.latestTickerSentiment ?? "N/A"}`);
  if (result?.runtime?.includeSourceUrls && s.fullContentFileUrl) {
    lines.push(`- Full Content URL: ${s.fullContentFileUrl}`);
  }
  lines.push(`- X Posts: ${x.itemCount ?? "N/A"} (${x.sourceMode ?? "N/A"})`);
  lines.push(`- X Top Post: ${x.topPostText ?? "N/A"}`);
  lines.push("");

  lines.push("## risks");
  if (quality.warnings.length === 0) {
    lines.push("- No critical data quality warnings.");
  } else {
    for (const warning of quality.warnings) lines.push(`- ${warning}`);
  }
  lines.push(`- Evolution cached hits: ${evolution?.used_from_cache ?? 0}`);
  lines.push(`- New tools learned: ${evolution?.new_tools_learned?.length ?? 0}`);
  lines.push("- This output is for research only, not investment advice.");
  lines.push("");

  lines.push("## conclusion");
  if (q.percentChange != null && t.rsi != null) {
    const view = q.percentChange > 0 && t.rsi < 70 ? "偏正向，但需持续跟踪事件风险" : "信号存在分歧，建议观望或分批评估";
    lines.push(`- Consolidated view: ${view}`);
  } else {
    lines.push("- Consolidated view: 数据有限，建议补齐后再决策。");
  }

  return lines.join("\n");
}

function capabilitiesForMode(mode) {
  if (mode === "basic") return ["quote", "fundamentals"];
  if (mode === "fundamental") return ["quote", "fundamentals", "sentiment", "x_sentiment"];
  if (mode === "technical") return ["quote", "technicals", "sentiment", "x_sentiment"];
  return ["quote", "fundamentals", "technicals", "sentiment", "x_sentiment"];
}

function historyDateRange(days = 45) {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function latestCompletedReportPeriod() {
  const now = new Date();
  const month = now.getMonth() + 1;
  let year = now.getFullYear();
  let period = "0930";
  if (month <= 4) {
    year -= 1;
    period = "0930";
  } else if (month <= 8) {
    period = "0331";
  } else if (month <= 10) {
    period = "0630";
  } else {
    period = "0930";
  }
  return { year: String(year), period };
}

function capabilityQueries(capability, market) {
  const queries = [CAPABILITY_QUERIES[capability]];
  if (capability === "x_sentiment") {
    queries.push("X Finance domain hot topics API");
  }
  if (capability === "sentiment" && ["CN", "HK"].includes(market)) {
    queries.unshift("caidazi A股 港股 研报 新闻 公众号 搜索");
  }
  if (["CN", "HK"].includes(market) && CN_HK_QUERY_HINTS[capability]) {
    queries.push(CN_HK_QUERY_HINTS[capability]);
  }
  return queries;
}

async function searchAndRankByCapability(capability, options) {
  const all = [];
  let chosenSearchId = null;
  for (const query of capabilityQueries(capability, options.market)) {
    const res = await searchTools(query, options.limit, options.timeoutMs);
    chosenSearchId = chosenSearchId || res.search_id;
    for (const tool of res.results || []) {
      all.push(tool);
    }
  }
  const bestById = new Map();
  for (const tool of all) {
    const key = tool.tool_id;
    if (!bestById.has(key) || scoreTool(tool) > scoreTool(bestById.get(key))) {
      bestById.set(key, tool);
    }
  }
  let ranked = rankTools([...bestById.values()])
    .filter((tool) => isToolCompatibleForCapability(tool?.tool_id, capability, options.market))
    .sort(
    (a, b) =>
      (b._score || 0) +
      marketCapabilityBoost(b, capability, options.market) -
      ((a._score || 0) + marketCapabilityBoost(a, capability, options.market)),
    );
  ranked = prioritizeCandidatesByMarket(ranked, capability, options.market);
  if (capability === "fundamentals" && ["CN", "HK"].includes(options.market)) {
    ranked = ranked.sort((a, b) => {
      const p = thsFundamentalPriority(b?.tool_id) - thsFundamentalPriority(a?.tool_id);
      if (p !== 0) return p;
      return (b._score || 0) - (a._score || 0);
    });
  }
  if (capability === "x_sentiment") {
    ranked = ranked.filter((tool) => {
      const id = tool?.tool_id || "";
      return X_SENTIMENT_TOOL_PREFIXES.some((prefix) => id.startsWith(prefix));
    });
    ranked = ranked.sort((a, b) => {
      const aId = a.tool_id || "";
      const bId = b.tool_id || "";
      const aPrimary = aId.startsWith("x_developer.2.tweets.search.recent") ? 1 : 0;
      const bPrimary = bId.startsWith("x_developer.2.tweets.search.recent") ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      return (b._score || 0) - (a._score || 0);
    });
  }
  if (capability === "sentiment" && ["CN", "HK"].includes(options.market)) {
    const caidaziOnly = ranked.filter((tool) => isCaidaziTool(tool?.tool_id));
    if (caidaziOnly.length > 0) {
      caidaziOnly.sort((a, b) => {
        const p = caidaziPriority(b?.tool_id) - caidaziPriority(a?.tool_id);
        if (p !== 0) return p;
        return (b._score || 0) - (a._score || 0);
      });
      ranked = [...caidaziOnly, ...ranked.filter((tool) => !isCaidaziTool(tool?.tool_id))];
    }
  }
  return { ranked, searchId: chosenSearchId };
}

async function runSingleAnalysis(symbol, options) {
  const resolvedInput = resolveRequestedSymbol(symbol, options.market);
  const effectiveMarket = resolvedInput.market;
  const candidates = normalizeSymbols(resolvedInput.symbol, effectiveMarket);
  let selectedSymbol = candidates[0];
  const output = { quote: null, fundamentals: null, technicals: null, sentiment: null, x_sentiment: null };
  const evolutionSummary = {
    used_from_cache: 0,
    new_tools_learned: [],
    queue_top3: {},
  };

  const activeCapabilities = capabilitiesForMode(options.mode);

  for (const candidate of candidates) {
    selectedSymbol = candidate;
    let foundAny = false;
    for (const capability of activeCapabilities) {
      const evolvedCandidates = options.evolutionState
        ? getEvolutionCandidates(options.evolutionState, capability, effectiveMarket)
        : [];
      const marketAwareEvolvedCandidates = prioritizeCandidatesByMarket(evolvedCandidates, capability, effectiveMarket);
      const nativeCoreCapability =
        ["CN", "HK"].includes(effectiveMarket) && ["quote", "fundamentals", "technicals"].includes(capability);
      const cnHkSentimentNeedsCaidazi = ["CN", "HK"].includes(effectiveMarket) && capability === "sentiment";
      const hasNativeEvolved = marketAwareEvolvedCandidates.some((x) =>
        String(x?.tool_id || "").startsWith("ths_ifind."),
      );
      const hasCaidaziEvolved = marketAwareEvolvedCandidates.some((x) => isCaidaziTool(x?.tool_id));
      const activeEvolvedCandidates =
        (nativeCoreCapability && !hasNativeEvolved) || (cnHkSentimentNeedsCaidazi && !hasCaidaziEvolved)
          ? []
          : marketAwareEvolvedCandidates;
      evolutionSummary.queue_top3[capability] = activeEvolvedCandidates.slice(0, 3).map((x) => x.tool_id);
      if (activeEvolvedCandidates.length === 0) {
        evolutionSummary.queue_top3[capability] = [];
      }
      let ranked = [];
      let searchId = null;
      const runtimeOptions = { ...options, market: effectiveMarket };
      if (activeEvolvedCandidates.length === 0) {
        const search = await searchAndRankByCapability(capability, runtimeOptions);
        ranked = search.ranked;
        searchId = search.searchId;
      }
      if (ranked.length === 0 && activeEvolvedCandidates.length === 0) {
        output[capability] = { success: false, reason: "no tools found", attempts: [] };
        continue;
      }
      foundAny = true;
      let executed = null;
      let cachedAttempt = null;
      if (activeEvolvedCandidates.length > 0) {
        cachedAttempt = await executeWithFallback(
          activeEvolvedCandidates,
          null,
          (tool) =>
            buildParamsForCapability(capability, candidate, options.mode, tool, effectiveMarket, {
              originalInput: resolvedInput.original,
            }),
          options,
          {
            capability,
            market: effectiveMarket,
            symbol: candidate,
            successValidator: (raw) => isParsedDataUsable(capability, parseCapability(capability, raw)),
          },
        );
        if (cachedAttempt.success) {
          evolutionSummary.used_from_cache += 1;
          executed = { ...cachedAttempt, fromEvolutionQueue: true };
        }
      }
      if (!executed) {
        if (ranked.length === 0) {
          const search = await searchAndRankByCapability(capability, runtimeOptions);
          ranked = search.ranked;
          searchId = search.searchId;
        }
        const freshAttempt = await executeWithFallback(
          ranked,
          searchId,
          (tool) =>
            buildParamsForCapability(capability, candidate, options.mode, tool, effectiveMarket, {
              originalInput: resolvedInput.original,
            }),
          options,
          {
            capability,
            market: effectiveMarket,
            symbol: candidate,
            successValidator: (raw) => isParsedDataUsable(capability, parseCapability(capability, raw)),
          },
        );
        executed = { ...freshAttempt, fromEvolutionQueue: false, previousCacheAttempt: cachedAttempt };
      }
      output[capability] = {
        ...executed,
        rankedTop: ranked.slice(0, 3).map((t) => t.tool_id),
      };
      if (executed.success) {
        output[capability].parsed = sanitizeParsedCapability(
          parseCapability(capability, executed.successfulResult),
          options,
        );
      }
      delete output[capability].successfulResult;
    }
    if (foundAny) break;
  }

  const quality = summarizeQuality(output);
  evolutionSummary.new_tools_learned = [...new Set(options.newlyLearnedTools || [])];
  return {
    symbol: selectedSymbol,
    market: effectiveMarket,
    mode: options.mode,
    data: output,
    quality,
    evolution: evolutionSummary,
    runtime: {
      includeSourceUrls: Boolean(options.includeSourceUrls),
      evolutionEnabled: Boolean(options.evolutionEnabled),
      resolvedInput: {
        original: resolvedInput.original,
        symbol: resolvedInput.symbol,
        market: resolvedInput.market,
        resolvedBy: resolvedInput.resolvedBy,
      },
    },
  };
}

function parseCapability(capability, raw) {
  if (capability === "quote") return pickQuoteData(raw);
  if (capability === "fundamentals") return pickFundamentalData(raw);
  if (capability === "technicals") return pickTechnicalData(raw);
  if (capability === "sentiment") return pickSentimentData(raw);
  if (capability === "x_sentiment") return pickXSentimentData(raw);
  return raw;
}

function sanitizeParsedCapability(parsed, options) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const cleaned = { ...parsed };
  if (!options?.includeSourceUrls) {
    delete cleaned.fullContentFileUrl;
  }
  return cleaned;
}

function buildParamsForCapability(capability, symbol, mode, tool, market, context = {}) {
  const toolId = tool?.tool_id || "";
  const thsCode = toThsCode(symbol, market);
  const base = String(symbol || "").toUpperCase().replace(/\.(US|HK|SH|SZ|SS)$/, "");
  const originalInput = String(context.originalInput || "").trim();
  const keyword = hasCjk(originalInput) ? originalInput : hasCjk(symbol) ? String(symbol) : base;
  const caidaziTicker = market === "HK" ? base.replace(/^0+/, "").padStart(4, "0") : base;
  const recentStart = historyDateRange(120).start;
  const report = latestCompletedReportPeriod();

  if (toolId.startsWith("ths_ifind.real_time_quotation")) {
    return { codes: thsCode };
  }
  if (toolId.startsWith("ths_ifind.company_basics")) {
    return { codes: thsCode };
  }
  if (toolId.startsWith("ths_ifind.financial_statements")) {
    return { statement_type: "income", codes: thsCode, year: report.year, period: report.period, type: "1" };
  }
  if (toolId.startsWith("ths_ifind.income_statement")) {
    return { codes: thsCode, year: report.year, period: report.period, type: "1" };
  }
  if (toolId.startsWith("ths_ifind.balance_sheet")) {
    return { codes: thsCode, year: report.year, period: report.period, type: "1" };
  }
  if (toolId.startsWith("ths_ifind.cash_flow_statement")) {
    return { codes: thsCode, year: report.year, period: report.period, type: "1" };
  }
  if (toolId.startsWith("ths_ifind.history_quotation")) {
    const range = historyDateRange(45);
    return { codes: thsCode, startdate: range.start, enddate: range.end, interval: "D" };
  }
  if (toolId.startsWith("finnhub.news")) {
    return { category: "general" };
  }
  if (toolId.startsWith("caidazi.search.hybrid_v2.query")) {
    return {
      input: keyword,
      ticker: caidaziTicker,
      sourceType: "report,news,wechat",
      size: 5,
      highlight: "true",
      sortOrder: "desc",
      publishTimeStart: recentStart,
      timeSensitive: true,
    };
  }
  if (toolId.startsWith("caidazi.news.query")) {
    return {
      input: keyword,
      ticker: caidaziTicker,
      size: 5,
      highlight: "true",
      sortOrder: "desc",
      publishTimeStart: recentStart,
    };
  }
  if (toolId.startsWith("caidazi.report.query")) {
    return {
      input: keyword,
      tsCode: caidaziTicker,
      size: 5,
      highlight: "true",
      sortOrder: "desc",
      publishDateStart: recentStart,
    };
  }
  if (toolId.startsWith("caidazi.search.hybrid.list")) {
    return { input: keyword };
  }
  if (toolId.startsWith("x_developer.2.tweets.search.recent")) {
    return {
      query: `(${base} OR $${base}) lang:en -is:retweet`,
      max_results: 20,
      sort_order: "relevancy",
    };
  }
  if (toolId.startsWith("qveris_social.x_domain_new_posts")) {
    return { domains: ["Finance"], limit: 20 };
  }
  if (toolId.startsWith("qveris_social.x_domain_hot_topics")) {
    return { domains: ["Finance"], limit: 20, min_engagement: 30 };
  }
  if (toolId.startsWith("qveris_social.x_domain_hot_events")) {
    return { domains: ["Finance"] };
  }

  if (capability === "quote") {
    return { symbol };
  }
  if (capability === "fundamentals") {
    return { function: "OVERVIEW", symbol };
  }
  if (capability === "technicals") {
    const interval = mode === "technical" ? "daily" : "daily";
    return { function: "RSI", symbol, interval, series_type: "close", time_period: 14 };
  }
  if (capability === "sentiment") {
    return { function: "NEWS_SENTIMENT", tickers: symbol, sort: "LATEST", limit: 10 };
  }
  if (capability === "x_sentiment") {
    return {
      query: `(${base} OR $${base}) lang:en -is:retweet`,
      max_results: 20,
      sort_order: "relevancy",
    };
  }
  return { symbol };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) return { help: true };
  const command = args[0];
  const parsed = {
    command,
    market: "GLOBAL",
    mode: "comprehensive",
    format: "markdown",
    limit: 10,
    maxSize: 30000,
    timeoutMs: 25000,
    maxAttemptsPerPhase: 3,
    includeSourceUrls: false,
    evolutionEnabled: true,
  };

  for (let i = 1; i < args.length; i++) {
    const key = args[i];
    if (key === "--symbol" && i + 1 < args.length) parsed.symbol = args[++i];
    else if (key === "--symbols" && i + 1 < args.length) parsed.symbols = args[++i];
    else if (key === "--market" && i + 1 < args.length) parsed.market = args[++i].toUpperCase();
    else if (key === "--mode" && i + 1 < args.length) parsed.mode = args[++i];
    else if (key === "--format" && i + 1 < args.length) parsed.format = args[++i];
    else if (key === "--limit" && i + 1 < args.length) parsed.limit = Number(args[++i]) || 10;
    else if (key === "--max-size" && i + 1 < args.length) parsed.maxSize = Number(args[++i]) || 30000;
    else if (key === "--timeout" && i + 1 < args.length) parsed.timeoutMs = (Number(args[++i]) || 25) * 1000;
    else if (key === "--include-source-urls") parsed.includeSourceUrls = true;
    else if (key === "--no-evolution") parsed.evolutionEnabled = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Stock Copilot Pro

Usage:
  node scripts/stock_copilot_pro.mjs analyze --symbol AAPL [options]
  node scripts/stock_copilot_pro.mjs compare --symbols AAPL,MSFT [options]

Options:
  --market US|HK|CN|GLOBAL   default GLOBAL
  --mode basic|fundamental|technical|comprehensive   default comprehensive
  --format markdown|json     default markdown
  --limit N                  search results per capability (default 10)
  --max-size N               max response size bytes (default 30000)
  --timeout N                timeout seconds (default 25)
  --include-source-urls      include provider full-content URLs in report
  --no-evolution             disable reading/writing .evolution state
  --help                     show this message
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  args.evolutionState = args.evolutionEnabled ? await loadEvolutionState() : null;
  args.newlyLearnedTools = [];

  if (args.command === "analyze") {
    if (!args.symbol) throw new Error("analyze requires --symbol");
    const result = await runSingleAnalysis(args.symbol, args);
    result.evolution.new_tools_learned = [...new Set(args.newlyLearnedTools)];
    if (args.evolutionEnabled && args.evolutionState) await saveEvolutionState(args.evolutionState);
    if (args.format === "json") console.log(JSON.stringify(result, null, 2));
    else console.log(formatMarkdown(result));
    return;
  }

  if (args.command === "compare") {
    if (!args.symbols) throw new Error("compare requires --symbols");
    const symbols = args.symbols.split(",").map((s) => s.trim()).filter(Boolean);
    const reports = [];
    for (const s of symbols) {
      reports.push(await runSingleAnalysis(s, args));
    }
    if (args.evolutionEnabled && args.evolutionState) await saveEvolutionState(args.evolutionState);
    if (args.format === "json") {
      console.log(
        JSON.stringify(
          {
            mode: "compare",
            market: args.market,
            reports,
            evolution: { new_tools_learned: [...new Set(args.newlyLearnedTools)] },
          },
          null,
          2,
        ),
      );
    } else {
      for (const report of reports) {
        report.evolution.new_tools_learned = [...new Set(args.newlyLearnedTools)];
        console.log(formatMarkdown(report));
        console.log("\n---\n");
      }
    }
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

main().catch((err) => {
  if (err.name === "AbortError") {
    console.error("Error: request timeout");
  } else {
    console.error(`Error: ${redactSecrets(err.message)}`);
  }
  process.exit(1);
});

