import { addEvent, getEvents, getLead, updateLead } from "@/lib/db";
import { errorResponse } from "@/lib/http";

// GET: one lead plus its activity timeline.
export async function GET(_req: Request, ctx: RouteContext<"/api/leads/[id]">) {
  const { id } = await ctx.params;
  try {
    const [lead, events] = await Promise.all([getLead(id), getEvents(id)]);
    return Response.json({ lead, events });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH: the only manual edit is marking a follow-up as done.
export async function PATCH(req: Request, ctx: RouteContext<"/api/leads/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.follow_up_status !== "done") {
    return Response.json({ error: 'Only { "follow_up_status": "done" } is supported' }, { status: 400 });
  }
  try {
    const lead = await updateLead(id, { follow_up_status: "done" });
    await addEvent(id, "follow_up_done", "Follow-up marked done");
    return Response.json({ lead });
  } catch (err) {
    return errorResponse(err);
  }
}
