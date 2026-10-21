"use client";
import { useEffect, useState } from "react";
import IntakeForm from "@/components/IntakeForm";
import LeadDetail from "@/components/LeadDetail";
import { api, ErrorBox, ScoreBadge, TagBadge } from "@/components/ui";
import type { Lead } from "@/lib/schemas";

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ leads: Lead[] }>("/api/leads")
      .then(({ leads }) => setLeads(leads))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Replace one lead in the list (after create, re-analyze, chat, etc.) without refetching everything.
  function upsert(lead: Lead) {
    setLeads((prev) => [lead, ...prev.filter((l) => l.id !== lead.id)]);
  }

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const sorted = [...leads].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="font-semibold">Lead Copilot</h1>
        <button onClick={() => setShowForm(true)} className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
          + New lead
        </button>
      </header>

      <div className="px-4 pt-3">
        <ErrorBox message={error} />
      </div>

      <main className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-gray-200 bg-white md:w-80 md:border-b-0 md:border-r">
          {loading && <p className="p-4 text-sm text-gray-500">Loading leads…</p>}
          {!loading && leads.length === 0 && <p className="p-4 text-sm text-gray-500">No leads yet.</p>}
          <ul>
            {sorted.map((lead) => (
              <li key={lead.id}>
                <button
                  onClick={() => setSelectedId(lead.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${lead.id === selectedId ? "bg-gray-100" : ""}`}
                >
                  <ScoreBadge score={lead.score} tag={lead.tag} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{lead.name}</span>
                  <TagBadge tag={lead.tag} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex-1 p-4">
          {selected ? (
            <LeadDetail key={selected.id} lead={selected} onUpdated={upsert} />
          ) : (
            <p className="text-sm text-gray-500">Select a lead, or add a new one.</p>
          )}
        </section>
      </main>

      {showForm && (
        <IntakeForm
          onClose={() => setShowForm(false)}
          onCreated={(lead, warning) => {
            upsert(lead);
            setSelectedId(lead.id);
            setShowForm(false);
            setError(warning ? `Lead saved, but analysis failed: ${warning}` : null);
          }}
        />
      )}
    </div>
  );
}
