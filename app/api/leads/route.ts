import { connection } from "next/server";
import { createLead, getLeads } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { analyzeLead } from "@/lib/leads";
import { LeadInputSchema } from "@/lib/schemas";

export const maxDuration = 60; // AI call + one retry + possible Groq fallback

export async function GET() {
  await connection(); // always run per request, never prerender at build time
  try {
    return Response.json({ leads: await getLeads() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const parsed = LeadInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }
  try {
    const lead = await createLead(parsed.data);
    // Save first, analyze second: if the AI fails, the lead isn't lost and can be re-analyzed.
    try {
      return Response.json({ lead: await analyzeLead(lead) }, { status: 201 });
    } catch (aiErr) {
      return Response.json({ lead, error: (aiErr as Error).message }, { status: 201 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
