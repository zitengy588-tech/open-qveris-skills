const BASE_URL = "https://qveris.ai/api/v1";

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

export function safeJsonParse(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pickPayload(rawResult) {
  return rawResult?.result?.data ?? rawResult?.data ?? rawResult?.result ?? rawResult ?? {};
}

function pickFullContentFileUrl(rawResult, payload) {
  return (
    payload?.full_content_file_url ??
    rawResult?.result?.full_content_file_url ??
    rawResult?.data?.full_content_file_url ??
    null
  );
}

export function resolveToolPayloadSync(rawResult) {
  const payload = pickPayload(rawResult);
  const truncated = payload?.truncated_content;
  const parsed = safeJsonParse(truncated);
  const fullContentFileUrl = pickFullContentFileUrl(rawResult, payload);
  const hasTruncatedContent = typeof truncated === "string";
  if (parsed != null) {
    return {
      content: parsed,
      meta: {
        contentMode: "truncated_content",
        hasTruncatedContent,
        fullContentFileUrl,
      },
    };
  }
  return {
    content: payload,
    meta: {
      contentMode: "payload",
      hasTruncatedContent,
      fullContentFileUrl,
    },
  };
}

export async function resolveToolPayload(rawResult, options = {}) {
  const initial = resolveToolPayloadSync(rawResult);
  if (initial.meta.contentMode !== "payload") return initial;
  if (!initial.meta.hasTruncatedContent) return initial;
  if (options.fetchFullContent === false) return initial;
  if (!initial.meta.fullContentFileUrl) return initial;

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Number(options.timeoutMs || 10_000);
  const { signal, cleanup } = timeoutSignal(timeoutMs);
  try {
    const res = await fetchImpl(initial.meta.fullContentFileUrl, { signal });
    if (!res.ok) {
      return {
        ...initial,
        meta: {
          ...initial.meta,
          fetchError: `full content fetch failed: ${res.status}`,
        },
      };
    }
    const fullContent = await res.json();
    return {
      content: fullContent,
      meta: {
        contentMode: "full_content_file_url",
        hasTruncatedContent: true,
        fullContentFileUrl: initial.meta.fullContentFileUrl,
      },
    };
  } catch (error) {
    return {
      ...initial,
      meta: {
        ...initial.meta,
        fetchError: error?.message || String(error),
      },
    };
  } finally {
    cleanup();
  }
}

export function getApiKey() {
  const key = process.env.QVERIS_API_KEY;
  if (!key) {
    console.error("Error: QVERIS_API_KEY environment variable is required.");
    process.exit(1);
  }
  return key;
}

export async function searchTools(query, limit = 10, timeoutMs = 25_000) {
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

export async function executeTool(toolId, searchId, parameters, maxResponseSize = 30_000, timeoutMs = 25_000) {
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
