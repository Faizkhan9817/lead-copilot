import { createLead, deleteAllLeads, getLeads } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { analyzeLead, dateInDays, processCallNotes } from "@/lib/leads";
import { SEED_LEADS } from "@/lib/seed-data";

export const maxDuration = 60;

// Resets the demo: wipes all leads, inserts the samples, and runs the REAL AI on each.
export async function POST() {
  try {
    await deleteAllLeads();
    const leads = [];
    for (const { callNotes, followUpDaysAgo, ...input } of SEED_LEADS) {
      leads.push({ lead: await createLead(input), callNotes, followUpDaysAgo });
    }

    // Analyze in parallel (~10 s instead of ~40 s). If Gemini rate-limits some of them, those fall back
    // to Groq; any that still fail stay saved as "not analyzed" and are reported, not hidden.
    const results = await Promise.allSettled(
      leads.map(async ({ lead, callNotes, followUpDaysAgo }) => {
        const analyzed = await analyzeLead(lead);
        if (callNotes) await processCallNotes(analyzed, callNotes, dateInDays(-(followUpDaysAgo ?? 0)));
      }),
    );
    const failed = results.filter((r) => r.status === "rejected").length;

    return Response.json({
      leads: await getLeads(),
      error: failed ? `${failed} of ${leads.length} sample leads couldn't be fully analyzed. Open them and click Analyze.` : undefined,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
