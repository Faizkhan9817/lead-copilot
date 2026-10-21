import { addEvent, createLead, deleteAllLeads, getLeads } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { analyzeLead } from "@/lib/leads";
import { SEED_LEADS } from "@/lib/seed-data";

export const maxDuration = 60;

// Resets the demo: wipes all leads, inserts the samples, and runs the REAL analysis on each.
export async function POST() {
  try {
    await deleteAllLeads();
    const leads = [];
    for (const { followUpDaysAgo, ...input } of SEED_LEADS) {
      const followUp =
        followUpDaysAgo === undefined
          ? {}
          : { follow_up_date: daysAgo(followUpDaysAgo), follow_up_status: "pending" as const };
      const lead = await createLead({ ...input, ...followUp });
      if (followUpDaysAgo !== undefined) {
        await addEvent(lead.id, "follow_up_scheduled", `Follow-up due ${lead.follow_up_date} (sample data)`);
      }
      leads.push(lead);
    }

    // Analyze in parallel (~10 s instead of ~40 s). If Gemini rate-limits some of them, those fall back
    // to Groq; any that still fail stay saved as "not analyzed" and are reported, not hidden.
    const results = await Promise.allSettled(leads.map(analyzeLead));
    const failed = results.filter((r) => r.status === "rejected").length;

    return Response.json({
      leads: await getLeads(),
      error: failed ? `${failed} of ${leads.length} sample leads couldn't be analyzed. Open them and click Analyze.` : undefined,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
