import { getLead } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { processCallNotes } from "@/lib/leads";
import { MAX_NOTES_CHARS } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/leads/[id]/call-notes">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!notes) return Response.json({ error: "Paste some call notes first" }, { status: 400 });
  if (notes.length > MAX_NOTES_CHARS * 2) {
    // Up to 8,000 characters go to the AI (the rest is cut off); beyond twice that, it's probably a mistake.
    return Response.json({ error: "Notes are too long. Paste the key parts of the call." }, { status: 400 });
  }
  try {
    return Response.json({ lead: await processCallNotes(await getLead(id), notes) });
  } catch (err) {
    return errorResponse(err);
  }
}
