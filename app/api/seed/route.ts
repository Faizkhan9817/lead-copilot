import { createLead, deleteAllLeads, getLeads } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { analyzeLead, dateInDays, processCallNotes } from "@/lib/leads";
import { SEED_LEADS } from "@/lib/seed-data";

export const maxDuration = 120; // 7 AI calls, paced 2 at a time, possibly waiting out a rate limit

const BATCH_SIZE = 2;

// Resets the demo: wipes all leads, inserts the samples, and runs the REAL AI on each.
export async function POST() {
  try {
    await deleteAllLeads();
    const leads = [];
    for (const { callNotes, followUpDaysAgo, ...input } of SEED_LEADS) {
      leads.push({ lead: await createLead(input), callNotes, followUpDaysAgo });
    }

    // Two at a time, not all at once: when Gemini's daily quota is used up, every call goes to Groq,
    // whose free tier allows ~8,000 tokens a minute, so 6 analyses fired together get rate-limited.
    // Failures stay saved as "not analyzed" and are reported, not hidden.
    const results: PromiseSettledResult<void>[] = [];
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE).map(async ({ lead, callNotes, followUpDaysAgo }) => {
        const analyzed = await analyzeLead(lead);
        if (callNotes) await processCallNotes(analyzed, callNotes, dateInDays(-(followUpDaysAgo ?? 0)));
      });
      results.push(...(await Promise.allSettled(batch)));
    }
    const failed = results.filter((r) => r.status === "rejected").length;

    return Response.json({
      leads: await getLeads(),
      error: failed ? `${failed} of ${leads.length} sample leads couldn't be fully analyzed. Open them and click Analyze.` : undefined,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
