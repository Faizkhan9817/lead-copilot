"use client";
import { useState } from "react";
import { MAX_MESSAGE_CHARS } from "@/lib/prompts";
import { isFollowUpDue, type Lead } from "@/lib/schemas";
import CallPrep from "./CallPrep";
import ChatPanel from "./ChatPanel";
import PostCall from "./PostCall";
import Timeline from "./Timeline";
import { api, Bullets, Button, Card, CopyButton, ErrorBox, formatDate, ScoreBadge, TagBadge, UrgencyFlag, useAction } from "./ui";

type Props = { lead: Lead; onUpdated: (lead: Lead) => void };
const TABS = ["Analysis", "Call", "Chat", "Activity"] as const;
type Tab = (typeof TABS)[number];

export default function LeadDetail({ lead, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>("Analysis");
  const { busy: analyzing, error, run } = useAction();
  const a = lead.analysis;

  const reanalyze = () =>
    run(async () => {
      const { lead: updated } = await api<{ lead: Lead }>(`/api/leads/${lead.id}/analyze`, { method: "POST" });
      onUpdated(updated);
    });

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
        <Button onClick={reanalyze} disabled={analyzing}>
          {analyzing ? "Analyzing…" : a ? "Re-analyze" : "Analyze"}
        </Button>
      </header>

      <ErrorBox message={error} />

      {isFollowUpDue(lead) && (
        <button
          onClick={() => setTab("Call")}
          className="flex w-full items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-left text-sm text-purple-800"
        >
          ⏰ <b>Follow-up due</b> since {formatDate(lead.follow_up_date!)}: {lead.last_call?.follow_up_reason}
          <span className="ml-auto font-medium">Open →</span>
        </button>
      )}

      <nav className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t ? "border-gray-900 font-medium text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
            {t === "Chat" && lead.chat.length > 0 && <span className="ml-1 text-xs text-gray-400">{lead.chat.length / 2}</span>}
          </button>
        ))}
      </nav>

      {tab === "Analysis" &&
        (!a ? (
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
              <CopyButton text={a.suggested_response} />
            </Card>
          </div>
        ))}

      {tab === "Call" && (
        <div className="space-y-3">
          <CallPrep lead={lead} onUpdated={onUpdated} />
          <PostCall lead={lead} onUpdated={onUpdated} />
        </div>
      )}

      {tab === "Chat" && <ChatPanel lead={lead} onUpdated={onUpdated} />}

      {tab === "Activity" && (
        <div className="space-y-3">
          <Card title="Timeline">
            <Timeline lead={lead} />
          </Card>
          <Card title="Original customer message">
            <p className="whitespace-pre-wrap text-sm text-gray-700">{lead.message || "(no message)"}</p>
            {lead.message.length > MAX_MESSAGE_CHARS && (
              <p className="mt-2 text-xs text-amber-700">
                Long message: only the first {MAX_MESSAGE_CHARS.toLocaleString()} characters were sent to the AI.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
