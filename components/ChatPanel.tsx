"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Lead } from "@/lib/schemas";
import { api, Card, ErrorBox } from "./ui";

const SUGGESTIONS = [
  "What should I emphasize on the call?",
  "Make my reply more assertive",
  "What's the biggest risk with this lead?",
  "Draft a short WhatsApp follow-up",
];

type Props = { lead: Lead; onUpdated: (lead: Lead) => void };

export default function ChatPanel({ lead, onUpdated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(lead.chat);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function send(text: string) {
    text = text.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);
    setStreaming(true);
    const before = messages;
    setMessages([...before, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/leads/${lead.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      // Errors before streaming starts come back as JSON with a status code.
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);

      // Read the plain-text stream and grow the last (assistant) message as chunks arrive.
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += value;
        setMessages([...before, { role: "user", content: text }, { role: "assistant", content: reply }]);
      }
      onUpdated({ ...lead, chat: [...before, { role: "user", content: text }, { role: "assistant", content: reply }] });
    } catch (err) {
      setMessages(before); // roll back the optimistic messages
      setInput(text); // give the salesperson their question back
      setError((err as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  async function clear() {
    if (!confirm("Clear the chat history for this lead?")) return;
    try {
      const { lead: updated } = await api<{ lead: Lead }>(`/api/leads/${lead.id}/chat`, { method: "DELETE" });
      setMessages([]);
      onUpdated(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card title={`Ask about ${lead.name.split(" ")[0]}`}>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">Answers use only this lead&apos;s details, analysis and this chat.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content || <span className="animate-pulse text-gray-400">Thinking…</span>}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={streaming}
            className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Ask a follow-up about this lead…"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          disabled={streaming || !input.trim()}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
      <div className="mt-2 flex items-center">
        <ErrorBox message={error} />
        {messages.length > 0 && !streaming && (
          <button onClick={clear} className="ml-auto text-xs text-gray-400 hover:text-gray-700">
            Clear chat
          </button>
        )}
      </div>
    </Card>
  );
}
