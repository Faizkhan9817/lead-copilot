import "server-only";
import type { z } from "zod";

export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type Provider = "gemini" | "groq";
type Options = { json?: boolean; stream?: boolean };

// An error whose message is safe and useful to show the salesperson.
export class AIError extends Error {}

const TIMEOUT_MS = 25_000; // whole request for normal calls
const STREAM_TIMEOUT_MS = 60_000; // streams stay open while text arrives

// ---------- Providers (plain fetch, no SDKs) ----------
// Each one sends the request and throws if it fails, so the caller can fall back.

async function geminiRequest(messages: Msg[], { json, stream }: Options): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  // Gemini takes the system prompt separately and calls the assistant role "model".
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, ...(json && { responseMimeType: "application/json" }) },
    }),
    signal: AbortSignal.timeout(stream ? STREAM_TIMEOUT_MS : TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function groqRequest(messages: Msg[], { json, stream }: Options): Promise<Response> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  // Groq uses the OpenAI chat format, so messages go through unchanged.
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      stream: !!stream,
      ...(json && { response_format: { type: "json_object" } }),
    }),
    signal: AbortSignal.timeout(stream ? STREAM_TIMEOUT_MS : TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

// Pull the text out of one response (or one streamed chunk) in each provider's format.
type Chunk = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]; // Gemini
  choices?: { message?: { content?: string }; delta?: { content?: string } }[]; // Groq
};
function extractText(provider: Provider, data: Chunk): string {
  if (provider === "gemini") return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const choice = data.choices?.[0];
  return choice?.message?.content ?? choice?.delta?.content ?? "";
}

// Try Gemini first; on any failure (bad key, 429 rate limit, 5xx, timeout) fall back to Groq.
async function requestWithFallback(messages: Msg[], options: Options): Promise<{ res: Response; provider: Provider }> {
  try {
    return { res: await geminiRequest(messages, options), provider: "gemini" };
  } catch (geminiErr) {
    console.warn("[ai] Gemini failed, falling back to Groq:", (geminiErr as Error).message);
    try {
      return { res: await groqRequest(messages, options), provider: "groq" };
    } catch (groqErr) {
      console.error("[ai] Groq also failed:", (groqErr as Error).message);
      throw new AIError(
        "The AI service is unavailable right now (both Gemini and Groq failed). Check the API keys or try again in a minute.",
      );
    }
  }
}

// ---------- Public API ----------

export async function callModel(messages: Msg[], json = false): Promise<{ text: string; provider: Provider }> {
  const { res, provider } = await requestWithFallback(messages, { json });
  const text = extractText(provider, await res.json());
  if (!text) throw new AIError("The AI returned an empty response. Please try again.");
  return { text, provider };
}

// Streaming: the fallback can only happen before the first chunk arrives (once text has been sent to
// the browser we can't switch providers), which is when rate-limit and auth errors happen anyway.
export async function streamModel(messages: Msg[]): Promise<{ textStream: AsyncGenerator<string>; provider: Provider }> {
  const { res, provider } = await requestWithFallback(messages, { stream: true });
  return { textStream: readSSE(res, provider), provider };
}

// Both providers stream Server-Sent Events: lines of `data: {json}`. Yield just the text pieces.
async function* readSSE(res: Response, provider: Provider): AsyncGenerator<string> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep a partial last line for the next read
    for (const line of lines) {
      const payload = line.trim().replace(/^data: ?/, "");
      if (!line.startsWith("data:") || payload === "[DONE]") continue;
      const text = extractText(provider, JSON.parse(payload));
      if (text) yield text;
    }
  }
}

// Ask for JSON, validate it with Zod, and retry once (telling the model what was wrong) if it doesn't fit.
export async function generateJson<T>(
  schema: z.ZodType<T>,
  messages: Msg[],
): Promise<{ data: T; provider: Provider }> {
  let convo = messages;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text, provider } = await callModel(convo, true);
    let problem: string;
    try {
      const parsed = schema.safeParse(JSON.parse(stripCodeFences(text)));
      if (parsed.success) return { data: parsed.data, provider };
      problem = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch {
      problem = "the response was not valid JSON";
    }
    console.warn(`[ai] invalid JSON on attempt ${attempt}: ${problem}`);
    convo = [
      ...messages,
      { role: "assistant", content: text },
      { role: "user", content: `Your JSON was invalid (${problem}). Reply with ONLY the corrected JSON object.` },
    ];
  }
  throw new AIError("The AI returned an unexpected format twice. Please try again.");
}

// Some models wrap JSON in ```json fences even when asked not to.
function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
