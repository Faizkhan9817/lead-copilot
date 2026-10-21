import { streamModel } from "@/lib/ai";
import { getLead, updateLead } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { chatMessages, MAX_CHAT_INPUT_CHARS } from "@/lib/prompts";
import type { ChatMessage } from "@/lib/schemas";

export const maxDuration = 60;

// Streams the assistant's reply as plain text, then saves both messages to this lead's chat history.
export async function POST(req: Request, ctx: RouteContext<"/api/leads/[id]/chat">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "Message is empty" }, { status: 400 });
  if (message.length > MAX_CHAT_INPUT_CHARS) {
    return Response.json({ error: `Message is too long (max ${MAX_CHAT_INPUT_CHARS} characters)` }, { status: 400 });
  }

  let lead, textStream, provider;
  try {
    lead = await getLead(id);
    // Errors up to here (bad key, rate limit on both providers, DB) return normal JSON errors.
    ({ textStream, provider } = await streamModel(chatMessages(lead, message)));
  } catch (err) {
    return errorResponse(err);
  }

  const history = lead.chat;
  const stream = new ReadableStream<string>({
    async start(controller) {
      let reply = "";
      try {
        for await (const chunk of textStream) {
          reply += chunk;
          controller.enqueue(chunk);
        }
      } catch (err) {
        console.error("[chat] stream failed:", (err as Error).message);
        controller.enqueue("\n\n[Reply interrupted. Please try again.]");
        controller.close();
        return; // don't save a half answer
      }
      // Save inside the stream (before closing it) so the serverless function can't exit before the write.
      try {
        const chat: ChatMessage[] = [...history, { role: "user", content: message }, { role: "assistant", content: reply }];
        await updateLead(id, { chat });
      } catch (err) {
        controller.enqueue(`\n\n[This reply couldn't be saved: ${(err as Error).message}]`);
      }
      controller.close();
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Provider": provider },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/leads/[id]/chat">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ lead: await updateLead(id, { chat: [] }) });
  } catch (err) {
    return errorResponse(err);
  }
}
