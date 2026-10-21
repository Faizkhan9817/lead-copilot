import { getLead } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { generateCallPrep } from "@/lib/leads";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<"/api/leads/[id]/call-prep">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ lead: await generateCallPrep(await getLead(id)) });
  } catch (err) {
    return errorResponse(err);
  }
}
