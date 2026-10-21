"use client";
import { useEffect, useState } from "react";
import { isFollowUpDue, type Lead, type LeadEvent } from "@/lib/schemas";
import { api, ErrorBox, formatDate } from "./ui";

const ICONS: Record<LeadEvent["type"], string> = {
  created: "➕",
  analyzed: "🤖",
  call_notes: "📞",
  follow_up_scheduled: "📅",
  follow_up_done: "✅",
};

// Activity timeline, fetched fresh each time the tab opens. "Follow-up due" is computed, not stored.
export default function Timeline({ lead }: { lead: Lead }) {
  const [events, setEvents] = useState<LeadEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ events: LeadEvent[] }>(`/api/leads/${lead.id}`)
      .then(({ events }) => setEvents(events))
      .catch((err) => setError(err.message));
  }, [lead.id, lead.score, lead.follow_up_status]); // refetch when something that logs an event changed

  if (error) return <ErrorBox message={error} />;
  if (!events) return <p className="text-sm text-gray-500">Loading activity…</p>;

  return (
    <ol className="space-y-3">
      {isFollowUpDue(lead) && (
        <li className="flex gap-3 text-sm">
          <span>⏰</span>
          <div>
            <p className="font-medium text-purple-700">Follow-up due</p>
            <p className="text-xs text-gray-500">Since {formatDate(lead.follow_up_date!)}</p>
          </div>
        </li>
      )}
      {[...events].reverse().map((e) => (
        <li key={e.id} className="flex gap-3 text-sm">
          <span>{ICONS[e.type] ?? "•"}</span>
          <div>
            <p>{e.detail}</p>
            <p className="text-xs text-gray-500">
              {formatDate(e.created_at)}, {new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
