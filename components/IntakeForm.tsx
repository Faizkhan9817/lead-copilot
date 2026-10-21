"use client";
import { useState } from "react";
import type { Lead } from "@/lib/schemas";
import { api, ErrorBox } from "./ui";

const FIELDS = [
  { name: "name", label: "Name *", placeholder: "Priya Raghavan" },
  { name: "location", label: "Location", placeholder: "Whitefield, Bengaluru" },
  { name: "requirement", label: "Property requirement", placeholder: "3 BHK, ready to move, gated community" },
  { name: "budget", label: "Budget", placeholder: "₹1.4 – 1.6 Cr" },
  { name: "timeline", label: "Buying timeline", placeholder: "Within 1 month" },
] as const;

type Props = { onCreated: (lead: Lead, warning?: string) => void; onClose: () => void };

export default function IntakeForm({ onCreated, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)));
      // If the AI fails, the server still saves the lead and returns `error` alongside it.
      const { lead, error } = await api<{ lead: Lead; error?: string }>("/api/leads", { method: "POST", body });
      onCreated(lead, error);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="mt-8 w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">New lead</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.name} className={f.name === "requirement" ? "sm:col-span-2" : ""}>
              <span className="text-xs font-medium text-gray-600">{f.label}</span>
              <input
                name={f.name}
                required={f.name === "name"}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Customer message (inquiry or chat transcript)</span>
          <textarea
            name="message"
            rows={6}
            placeholder="Paste the customer's message or WhatsApp chat here…"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <ErrorBox message={error} />
        <div className="flex items-center justify-end gap-2">
          {submitting && <span className="mr-auto text-sm text-gray-500">Saving and analyzing with AI… (5–20 s)</span>}
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">
            Cancel
          </button>
          <button disabled={submitting} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
            {submitting ? "Analyzing…" : "Save & analyze"}
          </button>
        </div>
      </form>
    </div>
  );
}
