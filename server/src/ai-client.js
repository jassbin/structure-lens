// AI helper: dual-channel with auto fallback
// Primary: AI_PROVIDER_BASE_URL / AI_PROVIDER_API_KEY / AI_PROVIDER_MODEL (default Deepseek-v4-flash)
// Fallback: AI_FALLBACK_BASE_URL / AI_FALLBACK_API_KEY / AI_FALLBACK_MODEL (default hy3)
// Primary failure (non-2xx / network) auto retries once via fallback; tracks last used model.
const OPENAI_COMPATIBLE_BASE_PATTERN = /\/chat\/completions$/i;

let lastUsedModel = null;
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60000;
const AI_FALLBACK_TIMEOUT_MS = Number(process.env.AI_FALLBACK_TIMEOUT_MS) || 90000;

function stat() {
  return {
    primary: (process.env.AI_PROVIDER_MODEL || '').trim() || 'Deepseek-v4-flash',
    fallback: (process.env.AI_FALLBACK_MODEL || '').trim() || 'hy3',
    lastUsedModel,
    hasFallback: Boolean((process.env.AI_FALLBACK_BASE_URL || '').trim() && (process.env.AI_FALLBACK_API_KEY || '').trim()),
  };
}

function providerBase() {
  const b = (process.env.AI_PROVIDER_BASE_URL || '').trim();
  if (!b) throw new Error('AI_PROVIDER_BASE_URL not configured');
  return b.replace(/\/+$/, '');
}

function providerKey() {
  const k = (process.env.AI_PROVIDER_API_KEY || '').trim();
  if (!k) throw new Error('AI_PROVIDER_API_KEY not configured');
  return k;
}

function providerModel() {
  return (process.env.AI_PROVIDER_MODEL || '').trim() || 'Deepseek-v4-flash';
}

function fallbackBase() {
  return (process.env.AI_FALLBACK_BASE_URL || '').trim();
}

function fallbackKey() {
  return (process.env.AI_FALLBACK_API_KEY || '').trim();
}

function fallbackModel() {
  return (process.env.AI_FALLBACK_MODEL || '').trim() || 'hy3';
}

function endpoint(b) {
  return OPENAI_COMPATIBLE_BASE_PATTERN.test(b) ? b : b + '/chat/completions';
}

async function postCompletion(url, key, body, timeoutMs) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs || AI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error('AI provider request failed (' + res.status + ')');
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res;
}

async function chat(params) {
  const { messages, stream = false, model, json = false, ...rest } = params;
  const requestBody = { messages, stream, ...rest };
  if (json) requestBody.response_format = { type: 'json_object' };

  const candidates = [
    { name: 'primary', base: providerBase(), key: providerKey(), model: model || providerModel() },
  ];
  const fbBase = fallbackBase();
  const fbKey = fallbackKey();
  if (fbBase && fbKey) {
    candidates.push({ name: 'fallback', base: fbBase, key: fbKey, model: fallbackModel() });
  }

  let lastErr = null;
  for (const cand of candidates) {
    try {
      const body = { ...requestBody, model: cand.model };
      const timeoutMs = cand.name === 'fallback' ? AI_FALLBACK_TIMEOUT_MS : AI_TIMEOUT_MS;
      const res = await postCompletion(endpoint(cand.base), cand.key, body, timeoutMs);
      lastUsedModel = cand.model;
      if (stream) return streamSse(res);
      const data = await res.json();
      data.used_model = cand.model;
      console.log('[ai] ok via=' + cand.name + ' model=' + cand.model);
      return data;
    } catch (e) {
      lastErr = e;
      const perTimeout = (cand.name === 'fallback' ? AI_FALLBACK_TIMEOUT_MS : AI_TIMEOUT_MS);
      const why = (e && e.name === 'TimeoutError') ? ('timeout(' + perTimeout + 'ms)') : ((e && e.message) || 'net');
      console.error('[ai] ' + cand.name + ' failed model=' + cand.model + ' why=' + why);
    }
  }
  throw lastErr || new Error('AI provider request failed');
}

async function* streamSse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
        if (delta) yield delta;
      } catch (e) {
        // ignore malformed chunk
      }
    }
  }
}

async function chatText({ messages, model, temperature = 0.7, max_tokens = 2048, json = false }) {
  const data = await chat({ messages, model, temperature, max_tokens, json });
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content || '';
}

module.exports = { chat, chatText, stat };
