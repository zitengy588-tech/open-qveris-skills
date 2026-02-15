#!/usr/bin/env node

/**
 * Regression Test Runner for stock-copilot-pro
 *
 * Runs batch analysis on the regression dataset and asserts that:
 * 1. Symbol resolution succeeds (no raw Chinese name passthrough)
 * 2. Required fields have valid data (not null/N/A)
 *
 * Usage:
 *   node tests/regression.test.mjs [--suite smoke|full] [--concurrency N] [--verbose]
 *
 * Options:
 *   --suite          smoke|full (default: full)
 *   --concurrency    Parallel workers (default: 4)
 *   --analysis-mode  basic|fundamental|technical|comprehensive (default: basic)
 *   --timeout-sec    Per-analysis timeout in seconds (default: 10)
 *   --limit          Search result limit per capability (default: 5)
 *   --quick          Backward compatibility, equivalent to --suite smoke
 *   --verbose        Print detailed output for each sample
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const DATASET_FILE = path.join(__dirname, "regression-dataset.json");
const SCRIPT_FILE = path.join(SKILL_ROOT, "scripts", "stock_copilot_pro.mjs");

const DEFAULT_TIMEOUT_SEC = 10;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_SUITE = "full";
const DEFAULT_ANALYSIS_MODE = "basic";
const DEFAULT_LIMIT = 5;
const SMOKE_SAMPLE_IDS = ["cn-teruide", "hk-tencent", "us-apple", "cn-byd", "hk-code-direct"];

function parseArgs() {
  const args = process.argv.slice(2);
  const getArgValue = (key, fallback) => {
    const idx = args.indexOf(key);
    if (idx === -1 || idx + 1 >= args.length) return fallback;
    return args[idx + 1];
  };
  const quick = args.includes("--quick");
  const suite = quick ? "smoke" : getArgValue("--suite", DEFAULT_SUITE);
  const concurrency = Math.max(1, Number(getArgValue("--concurrency", String(DEFAULT_CONCURRENCY))) || DEFAULT_CONCURRENCY);
  const analysisMode = getArgValue("--analysis-mode", DEFAULT_ANALYSIS_MODE);
  const timeoutSec = Math.max(3, Number(getArgValue("--timeout-sec", String(DEFAULT_TIMEOUT_SEC))) || DEFAULT_TIMEOUT_SEC);
  const limit = Math.max(1, Number(getArgValue("--limit", String(DEFAULT_LIMIT))) || DEFAULT_LIMIT);
  return {
    suite: suite === "smoke" ? "smoke" : "full",
    concurrency,
    analysisMode,
    timeoutSec,
    limit,
    verbose: args.includes("--verbose"),
  };
}

async function loadDataset() {
  const raw = await fs.readFile(DATASET_FILE, "utf-8");
  return JSON.parse(raw);
}

function runAnalysis(sample, options) {
  // Process timeout must be significantly larger than per-tool timeout.
  // In `basic` mode there are 2 capabilities, each may try multiple tools.
  const capabilityFactor = options.analysisMode === "basic" ? 6 : 10;
  const timeoutMs = Math.max(25_000, options.timeoutSec * 1000 * capabilityFactor);
  const cmdArgs = [
    SCRIPT_FILE,
    "analyze",
    "--symbol",
    sample.input,
    "--market",
    sample.market || "GLOBAL",
    "--format",
    "json",
    "--mode",
    options.analysisMode,
    "--timeout",
    String(options.timeoutSec),
    "--limit",
    String(options.limit),
    "--no-evolution",
  ];
  return new Promise((resolve) => {
    const child = spawn("node", cmdArgs, {
      cwd: SKILL_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", options.verbose ? "inherit" : "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, error: "timeout", stdout: "" });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, error: `exit code ${code}`, stdout });
      } else {
        resolve({ success: true, stdout });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message, stdout: "" });
    });
  });
}

function parseResult(stdout) {
  try {
    // Find the JSON object in stdout (may have console.error logs before it)
    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const jsonStr = stdout.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function checkFieldHasValue(result, fieldPath) {
  const parts = fieldPath.split(".");
  let val = result;
  for (const p of parts) {
    if (val == null || typeof val !== "object") return false;
    val = val[p];
  }
  if (val == null) return false;
  if (typeof val === "string" && (val.trim() === "" || val.toLowerCase() === "n/a")) return false;
  return true;
}

function checkSymbolResolution(result, expectedPattern) {
  // Check that the resolved symbol matches expected pattern
  // JSON output has symbol at root level
  const symbol = result?.symbol;
  if (!symbol) return { ok: false, reason: "no symbol in result" };
  // Check if symbol contains the expected pattern (e.g. "300001.SZ" contains "300001.SZ")
  // or matches exactly
  const normalizedSymbol = symbol.toUpperCase().replace(/^0+/, "");
  const normalizedExpected = expectedPattern.toUpperCase().replace(/^0+/, "");
  if (!normalizedSymbol.includes(normalizedExpected) && normalizedSymbol !== normalizedExpected) {
    return { ok: false, reason: `symbol mismatch: got "${symbol}", expected pattern "${expectedPattern}"` };
  }
  return { ok: true };
}

function checkRequiredFields(result, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    // Map shorthand field names to actual JSON paths
    // JSON structure: { symbol, market, data: { quote: { parsed: { price, ... } }, fundamentals: { parsed: { name, ... } } } }
    const paths = {
      price: ["data.quote.parsed.price", "data.fundamentals.parsed.price"],
      name: ["data.fundamentals.parsed.name", "data.fundamentals.parsed.companyName"],
    };
    const candidates = paths[field] || [field];
    const found = candidates.some((p) => checkFieldHasValue(result, p));
    if (!found) missing.push(field);
  }
  return missing;
}

async function main() {
  const opts = parseArgs();
  const dataset = await loadDataset();
  let samples = dataset.samples;

  if (opts.suite === "smoke") {
    const smoke = samples.filter((s) => SMOKE_SAMPLE_IDS.includes(s.id));
    samples = smoke.length > 0 ? smoke : samples.slice(0, 5);
  }
  console.log(
    `Running ${samples.length} samples | suite=${opts.suite} | mode=${opts.analysisMode} | concurrency=${opts.concurrency} | timeout=${opts.timeoutSec}s | limit=${opts.limit}`,
  );

  const results = [];
  let passed = 0;
  let failed = 0;
  let cursor = 0;

  async function runOne(sample) {
    const startTime = Date.now();
    console.log(`\n--- [${sample.id}] Testing: "${sample.input}" (${sample.category}) ---`);

    const runResult = await runAnalysis(sample, opts);
    const elapsed = Date.now() - startTime;

    if (!runResult.success) {
      console.log(`  ❌ FAILED: ${runResult.error}`);
      return { ...sample, status: "FAILED", reason: runResult.error, elapsed };
    }

    const parsed = parseResult(runResult.stdout);
    if (!parsed) {
      console.log(`  ❌ FAILED: could not parse JSON output`);
      return { ...sample, status: "FAILED", reason: "parse error", elapsed };
    }

    if (opts.verbose) {
      console.log("  Parsed result keys:", Object.keys(parsed));
    }

    // Check symbol resolution
    const symbolCheck = checkSymbolResolution(parsed, sample.expected_symbol_pattern);
    if (!symbolCheck.ok) {
      console.log(`  ❌ FAILED: ${symbolCheck.reason}`);
      return { ...sample, status: "FAILED", reason: symbolCheck.reason, elapsed };
    }

    // Check required fields
    const missingFields = checkRequiredFields(parsed, sample.required_fields);
    if (missingFields.length > 0) {
      console.log(`  ⚠️ PARTIAL: missing fields: ${missingFields.join(", ")}`);
      return { ...sample, status: "PARTIAL", missing: missingFields, elapsed };
    }

    console.log(`  ✅ PASSED (${elapsed}ms)`);
    return { ...sample, status: "PASSED", elapsed };
  }

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= samples.length) return;
      const sample = samples[idx];
      const r = await runOne(sample);
      results.push(r);
      if (r.status === "PASSED") passed++;
      else failed++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, samples.length) }, () => worker()));

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("REGRESSION TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total: ${samples.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log();

  const failedResults = results.filter((r) => r.status !== "PASSED");
  if (failedResults.length > 0) {
    console.log("Failed samples:");
    for (const r of failedResults) {
      console.log(`  - [${r.id}] ${r.input}: ${r.reason || r.status}${r.missing ? ` (missing: ${r.missing.join(", ")})` : ""}`);
    }
  }

  // Exit with error if any failures
  if (failed > 0) {
    console.log("\n❌ Regression test FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ All regression tests PASSED");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Regression test error:", err);
  process.exit(1);
});
