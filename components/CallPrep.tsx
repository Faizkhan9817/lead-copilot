"use client";
import type { Lead } from "@/lib/schemas";
import { api, Button, Card, ErrorBox, useAction } from "./ui";

type Props = { lead: Lead; onUpdated: (lead: Lead) => void };

// Before the call: 3 talking points, 2 questions, likely objections with rebuttals. One screen.
export default function CallPrep({ lead, onUpdated }: Props) {
  const { busy, error, run } = useAction();
  const prep = lead.call_prep;

  const generate = () =>
    run(async () => {
      const { lead: updated } = await api<{ lead: Lead }>(`/api/leads/${lead.id}/call-prep`, { method: "POST" });
      onUpdated(updated);
    });

  return (
    <Card title="Before the call: prep">
      {!prep ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-500">Talking points, questions and objection rebuttals for this lead.</p>
          <Button primary onClick={generate} disabled={busy}>
            {busy ? "Preparing…" : "Generate call prep"}
          </Button>
        </div>
      ) : (
        <div className={`space-y-3 text-sm ${busy ? "opacity-50" : ""}`}>
          <div>
            <h4 className="mb-1 font-medium">Say</h4>
            <ol className="list-decimal space-y-0.5 pl-5">
              {prep.talking_points.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="mb-1 font-medium">Ask</h4>
            <ul className="space-y-0.5">
              {prep.questions.map((q, i) => (
                <li key={i}>❓ {q}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-1 font-medium">If they say…</h4>
            <ul className="space-y-1.5">
              {prep.objections.map((o, i) => (
                <li key={i}>
                  <span className="text-red-700">“{o.objection}”</span>
                  <span className="text-gray-400"> → </span>
                  {o.rebuttal}
                </li>
              ))}
            </ul>
          </div>
          <Button onClick={generate} disabled={busy}>
            {busy ? "Preparing…" : "Regenerate"}
          </Button>
        </div>
      )}
      <div className="mt-2">
        <ErrorBox message={error} />
      </div>
    </Card>
  );
}
