import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ollama,
  resolveHost,
  resolveModel,
  resolveContextSize,
  callOllama,
} from "../providers/ollama.mjs";

test("ollama voice is off unless OLLAMA_VOICE_MODEL is set", () => {
  assert.equal(ollama.isAvailable({}), false);
  assert.equal(ollama.isAvailable({ OLLAMA_HOST: "http://localhost:11434" }), false);
  assert.equal(ollama.isAvailable({ OLLAMA_VOICE_MODEL: "gemma4:26b" }), true);
});

test("ollama family is distinct (so it counts as cross-family vs Claude)", () => {
  assert.equal(ollama.family, "ollama");
  assert.equal(typeof ollama.complete, "function");
  assert.equal(typeof ollama.analyze, "function");
});

test("resolveHost defaults to localhost and strips a trailing slash", () => {
  assert.equal(resolveHost({}), "http://localhost:11434");
  assert.equal(resolveHost({ OLLAMA_HOST: "http://box:11434/" }), "http://box:11434");
});

test("resolveModel reads OLLAMA_VOICE_MODEL", () => {
  assert.equal(resolveModel({ OLLAMA_VOICE_MODEL: "  qwen3.6:27b  " }), "qwen3.6:27b");
  assert.equal(resolveModel({}), "");
});

test("resolveContextSize caps model defaults and accepts a safe override", () => {
  assert.equal(resolveContextSize({}), 8192);
  assert.equal(resolveContextSize({ OLLAMA_NUM_CTX: "16384" }), 16384);
  assert.equal(resolveContextSize({ OLLAMA_NUM_CTX: "1024" }), 8192);
  assert.equal(resolveContextSize({ OLLAMA_NUM_CTX: "not-a-number" }), 8192);
});

test("displayName reflects the configured model", () => {
  assert.equal(ollama.displayName({ env: { OLLAMA_VOICE_MODEL: "granite4.1:8b" } }), "Local (granite4.1:8b)");
  assert.equal(ollama.displayName({ env: {} }), "Local (Ollama)");
});

test("callOllama posts to /api/chat and returns message content", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, json: async () => ({ message: { content: '{"positions":[]}' } }) };
  };
  try {
    const out = await callOllama({
      host: "http://localhost:11434",
      model: "gemma4:26b",
      systemPrompt: "sys",
      userPrompt: "usr",
      timeoutMs: 5000,
    });
    assert.equal(out, '{"positions":[]}');
    assert.equal(calls[0].url, "http://localhost:11434/api/chat");
    assert.equal(calls[0].body.model, "gemma4:26b");
    assert.equal(calls[0].body.stream, false);
    assert.equal(calls[0].body.format, "json");
    assert.equal(calls[0].body.options.num_ctx, 8192);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("ollama.analyze parses a CouncilResult from the model JSON", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      message: {
        content: JSON.stringify({
          positions: [{ label: "Local view", weight: 1, summary: "s", supporting_evidence_ids: [1] }],
          confidence: "medium",
        }),
      },
    }),
  });
  try {
    const result = await ollama.analyze({
      question: "Q",
      evidence: [{ verse_id: 1, book_name: "John", chapter: 3, verse: 16, text: "..." }],
      env: { OLLAMA_VOICE_MODEL: "gemma4:26b" },
    });
    assert.ok(Array.isArray(result.positions));
    assert.equal(result.positions[0].label, "Local view");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("ollama.analyze retries one invalid structured response", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        message: {
          content:
            calls === 1
              ? "not valid JSON"
              : JSON.stringify({
                  positions: [
                    {
                      label: "Recovered view",
                      weight: 1,
                      summary: "s",
                      supporting_evidence_ids: [1],
                    },
                  ],
                  confidence: "low",
                }),
        },
      }),
    };
  };
  try {
    const result = await ollama.analyze({
      question: "Q",
      evidence: [{ verse_id: 1, book_name: "John", chapter: 3, verse: 16, text: "..." }],
      env: { OLLAMA_VOICE_MODEL: "gemma4:26b" },
    });
    assert.equal(calls, 2);
    assert.equal(result.positions[0].label, "Recovered view");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("callOllama throws (fail-soft upstream) on a non-ok response", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, statusText: "Not Found", text: async () => "model missing" });
  try {
    await assert.rejects(
      () => callOllama({ host: "http://localhost:11434", model: "nope", systemPrompt: "s", userPrompt: "u", timeoutMs: 2000 }),
      /Ollama 404/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
