#!/usr/bin/env node
/**
 * QVeris Capability Discovery & Tool Calling CLI
 *
 * Discover tools by capability and call them through QVeris.
 * Uses only Node.js built-in APIs (fetch) — zero external dependencies.
 *
 * SECURITY MANIFEST:
 *   Environment variables accessed: QVERIS_API_KEY (only)
 *   External endpoints called: https://qveris.ai/api/v1 (only)
 *   Local files read: none
 *   Local files written: none
 *
 * Usage:
 *   node scripts/qveris_tool.mjs discover "weather forecast"
 *   node scripts/qveris_tool.mjs call <tool_id> --discovery-id <id> --params '{"city": "London"}'
 *   node scripts/qveris_tool.mjs inspect <tool_id1> [tool_id2 ...]
 */

const BASE_URL = "https://qveris.ai/api/v1";

function getApiKey() {
  const key = process.env.QVERIS_API_KEY;
  if (!key) {
    console.error("Error: QVERIS_API_KEY environment variable not set");
    console.error("Get your API key at https://qveris.ai");
    process.exit(1);
  }
  return key;
}

function normalizeLegacyArgs(rawArgs) {
  const args = [...rawArgs];
  const warnings = new Set();
  const commandAliases = {
    search: "discover",
    execute: "call",
    invoke: "call",
    "get-by-ids": "inspect",
  };

  if (args.length > 0 && commandAliases[args[0]]) {
    warnings.add(`'${args[0]}' is deprecated; use '${commandAliases[args[0]]}' instead.`);
    args[0] = commandAliases[args[0]];
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--search-id") {
      warnings.add("'--search-id' is deprecated; use '--discovery-id' instead.");
      args[i] = "--discovery-id";
    }
  }

  return { args, warnings: [...warnings] };
}

async function discoverTools(query, limit = 10, timeoutMs = 30000) {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP Error: ${response.status}`);
      console.error(text);
      process.exit(1);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectToolsByIds(toolIds, discoveryId, timeoutMs = 30000) {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = { tool_ids: toolIds };
    if (discoveryId) body.search_id = discoveryId;

    const response = await fetch(`${BASE_URL}/tools/by-ids`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP Error: ${response.status}`);
      console.error(text);
      process.exit(1);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function callTool(toolId, discoveryId, parameters, maxResponseSize = 20480, timeoutMs = 120000) {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(`${BASE_URL}/tools/execute`);
    url.searchParams.set("tool_id", toolId);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search_id: discoveryId,
        parameters,
        max_response_size: maxResponseSize,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP Error: ${response.status}`);
      console.error(text);
      process.exit(1);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function displayDiscoveryResults(result) {
  const discoveryId = result.search_id ?? "N/A";
  const tools = result.results ?? [];
  const total = result.total ?? tools.length;

  console.log(`\nDiscovery ID: ${discoveryId}`);
  console.log(`Found ${total} tools\n`);

  if (tools.length === 0) {
    console.log("No tools found.");
    return;
  }

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const toolId = tool.tool_id ?? "N/A";
    const name = tool.name ?? "N/A";
    const desc = tool.description ?? "N/A";

    const stats = tool.stats ?? {};
    let successRate = stats.success_rate ?? "N/A";
    let avgTime = stats.avg_execution_time_ms ?? "N/A";

    if (typeof successRate === "number") {
      successRate = `${Math.round(successRate * 100)}%`;
    }
    if (typeof avgTime === "number") {
      avgTime = `${avgTime.toFixed(1)}ms`;
    }

    console.log(`[${i + 1}] ${name}`);
    console.log(`    ID: ${toolId}`);
    console.log(`    ${desc.length > 100 ? desc.slice(0, 100) + "..." : desc}`);
    console.log(`    Success: ${successRate} | Avg Time: ${avgTime}`);

    const params = tool.params ?? [];
    if (params.length > 0) {
      const required = params.filter((p) => p.required).map((p) => p.name);
      const optional = params.filter((p) => !p.required).map((p) => p.name);
      if (required.length > 0) {
        console.log(`    Required: ${required.join(", ")}`);
      }
      if (optional.length > 0) {
        const shown = optional.slice(0, 5).join(", ");
        console.log(`    Optional: ${shown}${optional.length > 5 ? "..." : ""}`);
      }
    }

    const examples = tool.examples ?? {};
    if (examples.sample_parameters) {
      console.log(`    Example: ${JSON.stringify(examples.sample_parameters)}`);
    }

    console.log();
  }
}

function displayCallResult(result) {
  const success = result.success ?? false;
  const execTime = result.elapsed_time_ms ?? "N/A";
  const cost = result.cost ?? 0;

  console.log(`\n${success ? "Success" : "Failed"}`);
  console.log(`Time: ${execTime}ms | Cost: ${cost}`);

  if (!success) {
    const error = result.error_message ?? "Unknown error";
    console.log(`Error: ${error}`);
  }

  const data = result.result ?? {};
  if (Object.keys(data).length > 0) {
    console.log("\nResult:");
    console.log(JSON.stringify(data, null, 2));
  }
}

function printUsage() {
  console.log(`QVeris Capability Discovery & Tool Calling CLI

Usage:
  node scripts/qveris_tool.mjs discover <query> [options]
  node scripts/qveris_tool.mjs call <tool_id> --discovery-id <id> [options]
  node scripts/qveris_tool.mjs inspect <tool_id> [tool_id2 ...] [options]

Commands:
  discover <query>            Discover tool candidates for a capability description
  call <tool_id>              Call the selected tool through QVeris
  inspect <id> [id2 ...]      Inspect tool details before reuse or calling

Notes:
  discover returns tool candidates and metadata, not final data results
  call returns the execution result

Options:
  --limit N          Max results for discover (default: 10)
  --discovery-id ID  Discovery ID from previous discover (required for call, optional for inspect)
  --params JSON      Tool parameters as JSON string (default: "{}")
  --max-size N       Max response size in bytes (default: 20480)
  --timeout N        Request timeout in seconds (default: 30 for discover/inspect, 60 for call)
  --json             Output raw JSON instead of formatted display
  --help             Show this help message

Examples:
  node scripts/qveris_tool.mjs discover "weather forecast API"
  node scripts/qveris_tool.mjs call openweathermap.weather.execute.v1 --discovery-id abc123 --params '{"city": "London"}'
  node scripts/qveris_tool.mjs inspect openweathermap.weather.execute.v1`);
}

function parseArgs(argv) {
  const normalized = normalizeLegacyArgs(argv.slice(2));
  const args = normalized.args;

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  for (const warning of normalized.warnings) {
    console.error(`Deprecated: ${warning}`);
  }

  const command = args[0];
  const parsed = { command, json: false };

  if (command === "discover") {
    if (args.length < 2) {
      console.error("Error: discover command requires a query argument");
      process.exit(1);
    }
    parsed.query = args[1];
    parsed.limit = 10;
    parsed.timeout = 30;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--limit" && i + 1 < args.length) {
        parsed.limit = parseInt(args[++i], 10);
      } else if (args[i] === "--timeout" && i + 1 < args.length) {
        parsed.timeout = parseInt(args[++i], 10);
      } else if (args[i] === "--json") {
        parsed.json = true;
      }
    }
  } else if (command === "call") {
    if (args.length < 2) {
      console.error("Error: call command requires a tool_id argument");
      process.exit(1);
    }
    parsed.toolId = args[1];
    parsed.discoveryId = null;
    parsed.params = "{}";
    parsed.maxSize = 20480;
    parsed.timeout = 60;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--discovery-id" && i + 1 < args.length) {
        parsed.discoveryId = args[++i];
      } else if (args[i] === "--params" && i + 1 < args.length) {
        parsed.params = args[++i];
      } else if (args[i] === "--max-size" && i + 1 < args.length) {
        parsed.maxSize = parseInt(args[++i], 10);
      } else if (args[i] === "--timeout" && i + 1 < args.length) {
        parsed.timeout = parseInt(args[++i], 10);
      } else if (args[i] === "--json") {
        parsed.json = true;
      }
    }

    if (!parsed.discoveryId) {
      console.error("Error: --discovery-id is required for call command");
      process.exit(1);
    }
  } else if (command === "inspect") {
    if (args.length < 2) {
      console.error("Error: inspect command requires at least one tool_id argument");
      process.exit(1);
    }
    parsed.toolIds = [];
    parsed.discoveryId = null;
    parsed.timeout = 30;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--discovery-id" && i + 1 < args.length) {
        parsed.discoveryId = args[++i];
      } else if (args[i] === "--timeout" && i + 1 < args.length) {
        parsed.timeout = parseInt(args[++i], 10);
      } else if (args[i] === "--json") {
        parsed.json = true;
      } else if (!args[i].startsWith("--")) {
        parsed.toolIds.push(args[i]);
      }
    }

    if (parsed.toolIds.length === 0) {
      console.error("Error: inspect command requires at least one tool_id argument");
      process.exit(1);
    }
  } else {
    console.error(`Error: unknown command '${command}'. Use 'discover', 'call', or 'inspect'.`);
    process.exit(1);
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv);

  try {
    if (args.command === "discover") {
      const result = await discoverTools(args.query, args.limit, args.timeout * 1000);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayDiscoveryResults(result);
      }
    } else if (args.command === "call") {
      let params;
      try {
        params = JSON.parse(args.params);
      } catch (e) {
        console.error(`Invalid JSON in --params: ${e.message}`);
        process.exit(1);
      }
      const result = await callTool(args.toolId, args.discoveryId, params, args.maxSize, args.timeout * 1000);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayCallResult(result);
      }
    } else if (args.command === "inspect") {
      const result = await inspectToolsByIds(args.toolIds, args.discoveryId, args.timeout * 1000);
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayDiscoveryResults(result);
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      console.error("Error: Request timed out");
    } else {
      console.error(`Error: ${e.message}`);
    }
    process.exit(1);
  }
}

main();
