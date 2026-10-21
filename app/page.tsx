"use client";
import { useEffect, useState } from "react";
import IntakeForm from "@/components/IntakeForm";
import LeadDetail from "@/components/LeadDetail";
import LeadList, { groupLeads } from "@/components/LeadList";
import { api, ErrorBox } from "@/components/ui";
import { isFollowUpDue, type Lead } from "@/lib/schemas";

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show the list and, on desktop, pre-select the top-priority lead so the detail pane is never empty.
  // (On mobile we stay on the list, since selecting a lead switches to the detail view.)
  function showLeads(list: Lead[]) {
    setLeads(list);
    if (window.matchMedia("(min-width: 768px)").matches) setSelectedId(groupLeads(list)[0]?.leads[0]?.id ?? null);
  }

  useEffect(() => {
    api<{ leads: Lead[] }>("/api/leads")
      .then(({ leads }) => showLeads(leads))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Replace one lead in the list (after create, re-analyze, chat, etc.) without refetching everything.
  function upsert(lead: Lead) {
    setLeads((prev) => [lead, ...prev.filter((l) => l.id !== lead.id)]);
  }

  async function loadSamples() {
    if (leads.length > 0 && !confirm("This replaces ALL current leads with the sample leads. Continue?")) return;
    setSeeding(true);
    setError(null);
    try {
      const { leads, error } = await api<{ leads: Lead[]; error?: string }>("/api/seed", { method: "POST" });
      showLeads(leads);
      if (error) setError(error);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="mr-auto whitespace-nowrap font-semibold">
          Lead Copilot <span className="hidden text-sm font-normal text-gray-500 sm:inline">· real-estate lead triage</span>
        </h1>
        <button
          onClick={loadSamples}
          disabled={seeding}
          className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {seeding ? "Analyzing…" : <><span className="hidden sm:inline">Load </span>samples</>}
        </button>
        <button onClick={() => setShowForm(true)} className="whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
          + New lead
        </button>
      </header>

      {error && (
        <div className="px-4 pt-3">
          <ErrorBox message={error} />
        </div>
      )}

      {/* Desktop: two panes side by side. Mobile: list OR detail, with a back button. */}
      <main className="flex min-h-0 flex-1">
        <aside
          className={`w-full overflow-y-auto border-r border-gray-200 bg-white md:block md:w-96 md:shrink-0 ${selected ? "hidden" : "block"}`}
        >
          {loading && <p className="p-4 text-sm text-gray-500">Loading leads…</p>}
          {seeding && <p className="p-4 text-sm text-gray-500">Running AI analysis on 6 sample leads (10–30 s)…</p>}
          {!loading && !seeding && leads.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">
              <p>No leads yet.</p>
              <button onClick={loadSamples} className="mt-2 font-medium text-gray-900 underline">
                Load 6 sample leads
              </button>
            </div>
          )}
          {!seeding && leads.length > 0 && (
            <p className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
              {leads.length} leads · <span className="text-purple-700">{plural(leads.filter(isFollowUpDue).length, "follow-up")} due</span> ·{" "}
              <span className="text-red-700">{leads.filter((l) => l.tag === "hot").length} hot</span>
            </p>
          )}
          {!seeding && <LeadList leads={leads} selectedId={selectedId} onSelect={setSelectedId} />}
        </aside>

        <section className={`min-w-0 flex-1 overflow-y-auto p-4 md:block ${selected ? "block" : "hidden"}`}>
          {selected ? (
            <>
              <button onClick={() => setSelectedId(null)} className="mb-3 text-sm text-gray-600 md:hidden">
                ← All leads
              </button>
              <LeadDetail key={selected.id} lead={selected} onUpdated={upsert} />
            </>
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
