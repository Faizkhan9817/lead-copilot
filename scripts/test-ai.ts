// Offline tests for lib/ai.ts: fakes `fetch` so no API keys or network are needed.
// Run: npm run test:ai
import assert from "node:assert/strict";
import { z } from "zod";
import { AIError, callModel, generateJson, streamModel } from "../lib/ai.ts";

const Schema = z.object({ score: z.number() });
const msgs = [{ role: "user" as const, content: "hi" }];

process.env.GEMINI_API_KEY = "fake";
process.env.GROQ_API_KEY = "fake";

const gemini = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
const groq = (text: string) => Response.json({ choices: [{ message: { content: text } }] });

// Queue of fake responses; each fetch call takes the next one.
function fakeFetch(...responses: Array<() => Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url.includes("groq") ? "groq" : "gemini");
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return next();
  }) as typeof fetch;
  return calls;
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

await test("Gemini works -> uses Gemini", async () => {
  const calls = fakeFetch(() => gemini("hello"));
  assert.deepEqual(await callModel(msgs), { text: "hello", provider: "gemini" });
  assert.deepEqual(calls, ["gemini"]);
});

await test("Gemini 429 rate limit -> falls back to Groq", async () => {
  const calls = fakeFetch(() => new Response("quota exceeded", { status: 429 }), () => groq("from groq"));
  assert.deepEqual(await callModel(msgs), { text: "from groq", provider: "groq" });
  assert.deepEqual(calls, ["gemini", "groq"]);
});

await test("Gemini key missing -> goes straight to Groq", async () => {
  delete process.env.GEMINI_API_KEY;
  const calls = fakeFetch(() => groq("ok"));
  assert.equal((await callModel(msgs)).provider, "groq");
  assert.deepEqual(calls, ["groq"]);
  process.env.GEMINI_API_KEY = "fake";
});

await test("Both providers fail -> friendly AIError", async () => {
  fakeFetch(() => new Response("bad key", { status: 401 }), () => new Response("down", { status: 503 }));
  await assert.rejects(callModel(msgs), (e) => e instanceof AIError && /unavailable/.test(e.message));
});

await test("Valid JSON (even in ```json fences) -> parsed", async () => {
  fakeFetch(() => gemini('```json\n{"score": 80}\n```'));
  assert.deepEqual((await generateJson(Schema, msgs)).data, { score: 80 });
});

await test("Malformed JSON -> retries once and succeeds", async () => {
  const calls = fakeFetch(() => gemini("not json"), () => gemini('{"score": 55}'));
  assert.deepEqual((await generateJson(Schema, msgs)).data, { score: 55 });
  assert.equal(calls.length, 2);
});

await test("Wrong shape twice -> friendly AIError, no third try", async () => {
  const calls = fakeFetch(() => gemini('{"score": "high"}'), () => gemini('{"nope": 1}'));
  await assert.rejects(generateJson(Schema, msgs), (e) => e instanceof AIError && /format/.test(e.message));
  assert.equal(calls.length, 2);
});

// Streaming: build an SSE response whose body arrives in the given raw pieces.
const sse = (...pieces: string[]) =>
  new Response(new ReadableStream({ start(c) { pieces.forEach((p) => c.enqueue(new TextEncoder().encode(p))); c.close(); } }));
const collect = async (gen: AsyncGenerator<string>) => { let out = ""; for await (const t of gen) out += t; return out; };
const gChunk = (text: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
const qChunk = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

await test("Stream from Gemini -> text pieces joined", async () => {
  fakeFetch(() => sse(gChunk("Hello "), gChunk("Priya")));
  const { textStream, provider } = await streamModel(msgs);
  assert.equal(provider, "gemini");
  assert.equal(await collect(textStream), "Hello Priya");
});

await test("Stream: Gemini 429 -> Groq stream (with [DONE])", async () => {
  fakeFetch(() => new Response("quota", { status: 429 }), () => sse(qChunk("Hi "), qChunk("there"), "data: [DONE]\n\n"));
  const { textStream, provider } = await streamModel(msgs);
  assert.equal(provider, "groq");
  assert.equal(await collect(textStream), "Hi there");
});

await test("Stream: an event split across two network reads is reassembled", async () => {
  const event = gChunk("split ok");
  fakeFetch(() => sse(event.slice(0, 20), event.slice(20)));
  assert.equal(await collect((await streamModel(msgs)).textStream), "split ok");
});
