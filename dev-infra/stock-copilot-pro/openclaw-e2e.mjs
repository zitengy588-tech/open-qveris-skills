#!/usr/bin/env node

/**
 * OpenClaw end-to-end test runner for stock-copilot-pro.
 *
 * Runs inside the openclaw container via:
 *   node /workspace/dev-infra/stock-copilot-pro/openclaw-e2e.mjs
 *
 * Each test case sends a prompt through `openclaw agent --local --json`,
 * parses the JSON response, and checks assertions.
 */

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const REPORT_DIR = "/workspace/dev-infra/stock-copilot-pro/reports";
const REPORT_PATH = join(REPORT_DIR, `openclaw-e2e-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);

const OPENCLAW_BIN = "/app/openclaw.mjs";
const TIMEOUT_SEC = 420;
const MAX_RETRIES = 1;

function isTimeoutLike(text) {
  const t = String(text || "").toLowerCase();
  return t.includes("request timed out") || t.includes("timed out before a response");
}

function hasQverisBranding(text) {
  return /qveris/i.test(String(text || ""));
}

function isRetryableFailure(reason, text, raw) {
  const t = String(text || "").toLowerCase();
  const r = String(reason || "").toLowerCase();
  if (raw?.timedOut) return true;
  if (isTimeoutLike(text)) return true;
  if (t.includes("unexpected_state") || r.includes("unexpected_state")) return true;
  if (r.includes("output too short")) return true;
  return false;
}

const TEST_CASES = [
  {
    id: "analyze-us",
    prompt: "Use stock-copilot-pro to analyze AAPL with a concise comprehensive report. Must include a metrics table, data source disclosure, and explicit QVeris attribution.",
    assert: (text) => {
      if (!text || text.length < 100) return { ok: false, reason: "output too short" };
      if (isTimeoutLike(text)) return { ok: false, reason: "request timed out" };
      if (!text.includes("AAPL")) return { ok: false, reason: "missing AAPL in output" };
      if (!text.includes("|")) return { ok: false, reason: "missing metrics table" };
      if (!hasQverisBranding(text)) return { ok: false, reason: "missing QVeris attribution" };
      return { ok: true };
    },
  },
  {
    id: "analyze-cn",
    prompt: "分析腾讯控股（0700.HK），给出精简版投资建议（控制在 250-400 字）。必须包含一个关键数据表、信源披露，并注明数据由 QVeris 提供。",
    assert: (text) => {
      if (!text || text.length < 100) return { ok: false, reason: "output too short" };
      if (isTimeoutLike(text)) return { ok: false, reason: "request timed out" };
      const hasTencent = /腾讯|0700|tencent/i.test(text);
      if (!hasTencent) return { ok: false, reason: "missing 腾讯/0700/Tencent in output" };
      if (!hasQverisBranding(text)) return { ok: false, reason: "missing QVeris attribution" };
      return { ok: true };
    },
  },
  {
    id: "compare",
    prompt: "Compare AAPL and MSFT, give me a side-by-side analysis using stock-copilot-pro. Include at least one comparison table and a QVeris data source disclosure.",
    assert: (text) => {
      if (!text || text.length < 100) return { ok: false, reason: "output too short" };
      if (isTimeoutLike(text)) return { ok: false, reason: "request timed out" };
      if (!text.includes("AAPL")) return { ok: false, reason: "missing AAPL" };
      if (!text.includes("MSFT")) return { ok: false, reason: "missing MSFT" };
      if (!text.includes("|")) return { ok: false, reason: "missing comparison table" };
      if (!hasQverisBranding(text)) return { ok: false, reason: "missing QVeris attribution" };
      return { ok: true };
    },
  },
  {
    id: "watch",
    prompt: "Add NVDA to my holdings using stock-copilot-pro, then show my current watchlist",
    assert: (text) => {
      if (!text) return { ok: false, reason: "empty output" };
      if (!text.includes("NVDA")) return { ok: false, reason: "missing NVDA in output" };
      return { ok: true };
    },
  },
  {
    id: "brief",
    prompt: "First, use stock-copilot-pro to add AAPL and MSFT to my holdings. Then generate a morning brief for my portfolio.",
    assert: (text) => {
      if (isTimeoutLike(text)) return { ok: false, reason: "request timed out" };
      if (!text || text.length < 50) return { ok: false, reason: "output too short for a brief" };
      return { ok: true };
    },
  },
  {
    id: "radar",
    prompt: "Use stock-copilot-pro to run a concise industry hot-topic radar for global markets (3 themes max). Tag each theme with source and include a QVeris source disclosure footer.",
    assert: (text) => {
      if (!text || text.length < 100) return { ok: false, reason: "output too short for radar" };
      if (isTimeoutLike(text)) return { ok: false, reason: "request timed out" };
      if (!/source|来源|信源/i.test(text)) return { ok: false, reason: "missing source labels" };
      if (!hasQverisBranding(text)) return { ok: false, reason: "missing QVeris attribution" };
      return { ok: true };
    },
  },
  {
    id: "invalid-input",
    prompt: "Use stock-copilot-pro to analyze symbol: INVALID_SYMBOL_XYZ_999. If input is invalid, return a graceful error.",
    assert: (text, result) => {
      if (result.exitCode !== 0) return { ok: false, reason: `crashed with exit code ${result.exitCode}` };
      if (!text) return { ok: false, reason: "empty output" };
      return { ok: true };
    },
  },
  {
    id: "unrelated",
    prompt: "What is 2+2? Do not use stock analysis tools for this simple math question.",
    assert: (text, result) => {
      if (result.exitCode !== 0) return { ok: false, reason: `crashed with exit code ${result.exitCode}` };
      if (!text) return { ok: false, reason: "empty output" };
      return { ok: true };
    },
  },
];

function runAgent(sessionId, message, timeoutSec) {
  const processTimeout = (timeoutSec + 30) * 1000;
  return new Promise((resolve) => {
    const args = [
      OPENCLAW_BIN,
      "agent",
      "--local",
      "--session-id", sessionId,
      "--message", message,
      "--json",
      "--timeout", String(timeoutSec),
    ];
    const startMs = Date.now();
    const child = spawn("node", args, {
      cwd: "/app",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: -1, stdout, stderr, durationMs: Date.now() - startMs, timedOut: true });
    }, processTimeout);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr, durationMs: Date.now() - startMs, timedOut: false });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout, stderr: err.message, durationMs: Date.now() - startMs, timedOut: false });
    });
  });
}

function extractPayloadText(stdout) {
  try {
    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return stdout.trim() || null;
    const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
    if (Array.isArray(parsed?.payloads) && parsed.payloads.length > 0) {
      return parsed.payloads.map((p) => p.text || "").join("\n").trim() || null;
    }
    return parsed?.payloads?.[0]?.text ?? (stdout.trim() || null);
  } catch {
    return stdout.trim() || null;
  }
}

function extractDurationMs(stdout) {
  try {
    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
    return parsed?.meta?.durationMs ?? null;
  } catch {
    return null;
  }
}

function truncate(str, maxLen = 200) {
  if (!str) return "(empty)";
  const clean = str.replace(/\n/g, " ").trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
}

async function main() {
  const ts = Date.now();
  console.log(`\nOpenClaw E2E Test Runner`);
  console.log(`Running ${TEST_CASES.length} test cases\n`);
  console.log("=".repeat(70));

  const results = [];

  for (const tc of TEST_CASES) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`[${tc.id}]`);
    console.log(`\n📥 INPUT:`);
    console.log(tc.prompt);

    let attempt = 0;
    let sessionId = "";
    let raw = null;
    let text = null;
    let agentDurationMs = null;
    let check = { ok: false, reason: "not executed" };

    while (attempt <= MAX_RETRIES) {
      sessionId = `e2e-${tc.id}-${ts}-try${attempt + 1}`;
      console.log(`\n  session: ${sessionId}`);
      raw = await runAgent(sessionId, tc.prompt, TIMEOUT_SEC);
      text = extractPayloadText(raw.stdout);
      agentDurationMs = extractDurationMs(raw.stdout) ?? raw.durationMs;
      check = tc.assert(text, raw);
      if (check.ok) break;
      if (attempt >= MAX_RETRIES || !isRetryableFailure(check.reason, text, raw)) break;
      console.log(`\n  ↻ Retry ${attempt + 1}/${MAX_RETRIES} due to: ${check.reason}`);
      attempt += 1;
    }

    const entry = {
      id: tc.id,
      passed: check.ok,
      reason: check.reason || null,
      exitCode: raw.exitCode,
      timedOut: raw.timedOut,
      durationMs: raw.durationMs,
      agentDurationMs,
      fullOutput: text || "(empty)",
      attempts: attempt + 1,
    };
    results.push(entry);

    console.log(`\n📤 OUTPUT (${(text || "").length} chars, ${(agentDurationMs / 1000).toFixed(1)}s):`);
    console.log(text || "(empty)");

    if (raw.stderr && raw.stderr.trim()) {
      console.log(`\n⚠️  STDERR (last 500 chars):`);
      const stderrTail = raw.stderr.trim().slice(-500);
      console.log(stderrTail);
    }

    const verdict = check.ok ? "✅ PASS" : `❌ FAIL: ${check.reason}`;
    console.log(`\n${verdict}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed} | Time: ${(totalMs / 1000).toFixed(1)}s\n`);

  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const dur = (r.agentDurationMs / 1000).toFixed(1);
    const detail = r.passed ? "" : ` -- ${r.reason}`;
    console.log(`  [${status}] ${r.id} (${dur}s)${detail}`);
  }

  // Write detailed markdown report
  const reportLines = [
    `# OpenClaw E2E Report`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    `**Total:** ${results.length} | **Passed:** ${passed} | **Failed:** ${failed} | **Time:** ${(totalMs / 1000).toFixed(1)}s`,
    ``,
    `## Summary`,
    ``,
    `| # | Case | Status | Duration |`,
    `|---|------|--------|----------|`,
  ];
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const dur = `${(r.agentDurationMs / 1000).toFixed(1)}s`;
    reportLines.push(`| ${results.indexOf(r) + 1} | ${r.id} | ${status} | ${dur} |`);
  }
  reportLines.push(``, `---`, ``);

  for (const r of results) {
    const status = r.passed ? "PASS" : `FAIL: ${r.reason}`;
    const tc = TEST_CASES.find((t) => t.id === r.id);
    reportLines.push(
      `## [${status}] ${r.id}`,
      ``,
      `**Duration:** ${(r.agentDurationMs / 1000).toFixed(1)}s | **Exit code:** ${r.exitCode} | **Timed out:** ${r.timedOut}`,
      ``,
      `### Input`,
      ``,
      "```",
      tc.prompt,
      "```",
      ``,
      `### Output (${(r.fullOutput || "").length} chars)`,
      ``,
      r.fullOutput || "(empty)",
      ``,
      `---`,
      ``,
    );
  }

  try {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(REPORT_PATH, reportLines.join("\n"), "utf-8");
    console.log(`\n📄 Report saved: ${REPORT_PATH}`);
  } catch (e) {
    console.error(`Failed to write report: ${e.message}`);
  }

  if (failed > 0) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`FAILED CASES DETAIL`);
    console.log("─".repeat(70));
    for (const r of results.filter((x) => !x.passed)) {
      console.log(`\n[${r.id}] ${r.reason}`);
      console.log(`  exit_code: ${r.exitCode}, timed_out: ${r.timedOut}`);
      console.log(`  full output:\n${r.fullOutput}`);
    }
    console.log(`\nOpenClaw E2E: FAILED`);
    process.exit(1);
  } else {
    console.log(`\nOpenClaw E2E: ALL PASSED`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("OpenClaw E2E runner error:", err);
  process.exit(1);
});
