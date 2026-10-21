"use client";
import { useState } from "react";
import { MAX_MESSAGE_CHARS } from "@/lib/prompts";
import type { Lead } from "@/lib/schemas";
import { api, Bullets, Card, ErrorBox, ScoreBadge, TagBadge, UrgencyFlag } from "./ui";

type Props = { lead: Lead; onUpdated: (lead: Lead) => void };

export default function LeadDetail({ lead, onUpdated }: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const a = lead.analysis;

  async function reanalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const { lead: updated } = await api<{ lead: Lead }>(`/api/leads/${lead.id}/analyze`, { method: "POST" });
      onUpdated(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function copyResponse() {
    if (!a) return;
    await navigator.clipboard.writeText(a.suggested_response);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      {/* Header: who, what, and the priority at a glance */}
      <header className="flex flex-wrap items-start gap-3">
        <ScoreBadge score={lead.score} tag={lead.tag} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{lead.name}</h2>
            <TagBadge tag={lead.tag} />
            <UrgencyFlag urgency={lead.urgency} />
          </div>
          <p className="text-sm text-gray-500">
            {[lead.location, lead.requirement, lead.budget, lead.timeline].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          onClick={reanalyze}
          disabled={analyzing}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {analyzing ? "Analyzing…" : a ? "Re-analyze" : "Analyze"}
        </button>
      </header>

      <ErrorBox message={error} />

      {!a ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          This lead hasn&apos;t been analyzed yet. Click <b>Analyze</b>.
        </p>
      ) : (
        <div className={`grid gap-3 md:grid-cols-2 ${analyzing ? "opacity-50" : ""}`}>
          <Card title="Summary" className="md:col-span-2">
            <p className="text-sm">{a.summary}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium text-gray-500">Intent: </span>
              {a.intent}
            </p>
          </Card>
          <Card title="Next action" className="border-l-4 border-l-gray-900 md:col-span-2">
            <p className="text-sm font-medium">{a.next_action}</p>
          </Card>
          <Card title={`Why score ${a.score}`}>
            <Bullets items={a.score_reasons} />
          </Card>
          <Card title="Key requirements">
            <Bullets items={a.key_requirements} />
          </Card>
          <Card title="Objections / concerns" className="md:col-span-2">
            <Bullets items={a.objections} empty="None raised" />
          </Card>
          <Card title="Suggested response" className="md:col-span-2">
            <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm">{a.suggested_response}</p>
            <button onClick={copyResponse} className="mt-2 text-xs font-medium text-gray-600 hover:text-gray-900">
              {copied ? "Copied ✓" : "Copy to clipboard"}
            </button>
          </Card>
        </div>
      )}

      <details className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
          Original customer message
        </summary>
        <p className="mt-2 whitespace-pre-wrap text-gray-700">{lead.message || "(no message)"}</p>
        {lead.message.length > MAX_MESSAGE_CHARS && (
          <p className="mt-2 text-xs text-amber-700">
            Long message: only the first {MAX_MESSAGE_CHARS.toLocaleString()} characters were sent to the AI.
          </p>
        )}
      </details>
    </div>
  );
}
