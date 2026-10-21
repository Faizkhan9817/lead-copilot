"use client";
import { useState } from "react";
import { isFollowUpDue, type Lead } from "@/lib/schemas";
import { api, Bullets, Button, Card, CopyButton, ErrorBox, formatDate, useAction } from "./ui";

type Props = { lead: Lead; onUpdated: (lead: Lead) => void };

// After the call: paste notes -> AI re-scores, extracts commitments/next steps, schedules and drafts the follow-up.
export default function PostCall({ lead, onUpdated }: Props) {
  const [notes, setNotes] = useState("");
  const submit = useAction();
  const markDone = useAction();
  const call = lead.last_call;

  const processNotes = () =>
    submit.run(async () => {
      const { lead: updated } = await api<{ lead: Lead }>(`/api/leads/${lead.id}/call-notes`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      setNotes("");
      onUpdated(updated);
    });

  const completeFollowUp = () =>
    markDone.run(async () => {
      const { lead: updated } = await api<{ lead: Lead }>(`/api/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ follow_up_status: "done" }),
      });
      onUpdated(updated);
    });

  return (
    <>
      <Card title="After the call: notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          disabled={submit.busy}
          placeholder="Quick notes or a transcript: what they said, what you promised, when to talk next…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button primary onClick={processNotes} disabled={submit.busy || !notes.trim()}>
            {submit.busy ? "Updating…" : "Process call notes"}
          </Button>
          {submit.busy && <span className="text-sm text-gray-500">Re-scoring and drafting follow-up…</span>}
        </div>
        <div className="mt-2">
          <ErrorBox message={submit.error} />
        </div>
      </Card>

      {call && (
        <Card title={`Last call · ${formatDate(call.created_at)}`}>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {call.score_before !== null && call.score_before !== call.score && (
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${call.score > call.score_before ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  Score {call.score_before} → {call.score}
                </span>
              )}
              <p>{call.summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 font-medium">Commitments</h4>
                <Bullets items={call.commitments} empty="None" />
              </div>
              <div>
                <h4 className="mb-1 font-medium">Next steps</h4>
                <Bullets items={call.next_steps} />
              </div>
            </div>

            {/* Follow-up: date, status, draft message */}
            <div className={`rounded-md border p-3 ${isFollowUpDue(lead) ? "border-purple-300 bg-purple-50" : "border-gray-200"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">
                  Follow-up {lead.follow_up_date && formatDate(lead.follow_up_date)}
                </h4>
                {lead.follow_up_status === "done" ? (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800">Done</span>
                ) : isFollowUpDue(lead) ? (
                  <span className="rounded bg-purple-600 px-1.5 py-0.5 text-xs font-semibold text-white">Due</span>
                ) : (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">Scheduled</span>
                )}
                {lead.follow_up_status === "pending" && (
                  <Button onClick={completeFollowUp} disabled={markDone.busy} className="ml-auto">
                    {markDone.busy ? "Saving…" : "Mark done"}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">{call.follow_up_reason}</p>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-white p-3">{call.follow_up_message}</p>
              <CopyButton text={call.follow_up_message} />
              <ErrorBox message={markDone.error} />
            </div>

            <details>
              <summary className="cursor-pointer text-xs text-gray-500">Your notes</summary>
              <p className="mt-1 whitespace-pre-wrap text-gray-600">{call.notes}</p>
            </details>
          </div>
        </Card>
      )}
    </>
  );
}
