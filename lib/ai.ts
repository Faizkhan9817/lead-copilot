import "server-only";
import type { z } from "zod";

export type Msg = { role: "system" | "user" | "assistant"; content: string };
type Provider = "gemini" | "groq";

// An error whose message is safe and useful to show the salesperson.
export class AIError extends Error {}

const TIMEOUT_MS = 25_000;

// ---------- Providers (plain fetch, no SDKs) ----------

async function callGemini(messages: Msg[], json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // Gemini takes the system prompt separately and calls the assistant role "model".
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.4, ...(json && { responseMimeType: "application/json" }) },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini returned no text (finishReason: ${data.candidates?.[0]?.finishReason})`);
  return text;
}

async function callGroq(messages: Msg[], json: boolean): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  // Groq uses the OpenAI chat format, so messages go through unchanged.
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      ...(json && { response_format: { type: "json_object" } }),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return text;
}

// ---------- Public API ----------

// Try Gemini first; on any failure (bad key, 429 rate limit, 5xx, timeout) fall back to Groq.
export async function callModel(messages: Msg[], json = false): Promise<{ text: string; provider: Provider }> {
  try {
    return { text: await callGemini(messages, json), provider: "gemini" };
  } catch (geminiErr) {
    console.warn("[ai] Gemini failed, falling back to Groq:", (geminiErr as Error).message);
    try {
      return { text: await callGroq(messages, json), provider: "groq" };
    } catch (groqErr) {
      console.error("[ai] Groq also failed:", (groqErr as Error).message);
      throw new AIError(
        "The AI service is unavailable right now (both Gemini and Groq failed). Check the API keys or try again in a minute.",
      );
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
