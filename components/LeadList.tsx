"use client";
import { isFollowUpDue, todayISO, type Lead } from "@/lib/schemas";
import { ScoreBadge, TagBadge, UrgencyFlag } from "./ui";

type Group = { title: string; leads: Lead[]; accent: string };

// Follow-ups due go first (oldest first); a lead appears in only one group.
// Everything else is grouped by tag and sorted by score, highest first.
export function groupLeads(leads: Lead[]): Group[] {
  const byScore = (a: Lead, b: Lead) => (b.score ?? -1) - (a.score ?? -1);
  const due = leads.filter(isFollowUpDue).sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));
  const rest = leads.filter((l) => !isFollowUpDue(l)).sort(byScore);
  return [
    { title: "Follow-ups due", leads: due, accent: "text-purple-700" },
    { title: "Hot", leads: rest.filter((l) => l.tag === "hot"), accent: "text-red-700" },
    { title: "Warm", leads: rest.filter((l) => l.tag === "warm"), accent: "text-amber-700" },
    { title: "Cold", leads: rest.filter((l) => l.tag === "cold"), accent: "text-blue-700" },
    { title: "Not analyzed", leads: rest.filter((l) => !l.tag), accent: "text-gray-500" },
  ].filter((g) => g.leads.length > 0);
}

function dueLabel(date: string): string {
  const days = Math.round((Date.parse(todayISO()) - Date.parse(date)) / 86_400_000);
  return days === 0 ? "Follow-up due today" : `Follow-up ${days} day${days === 1 ? "" : "s"} overdue`;
}

type Props = { leads: Lead[]; selectedId: string | null; onSelect: (id: string) => void };

export default function LeadList({ leads, selectedId, onSelect }: Props) {
  return (
    <nav>
      {groupLeads(leads).map((group) => (
        <div key={group.title}>
          <h2 className={`sticky top-0 z-10 bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide ${group.accent}`}>
            {group.title} · {group.leads.length}
          </h2>
          <ul>
            {group.leads.map((lead) => (
              <li key={lead.id}>
                <button
                  onClick={() => onSelect(lead.id)}
                  className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
                    lead.id === selectedId ? "bg-gray-100" : ""
                  }`}
                >
                  <ScoreBadge score={lead.score} tag={lead.tag} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{lead.name}</span>
                      <UrgencyFlag urgency={lead.urgency} />
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {lead.analysis?.intent ?? ([lead.requirement, lead.location].filter(Boolean).join(" · ") || "No details")}
                    </p>
                    {isFollowUpDue(lead) && (
                      <p className="mt-0.5 text-xs font-medium text-purple-700">{dueLabel(lead.follow_up_date!)}</p>
                    )}
                  </div>
                  <TagBadge tag={lead.tag} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
