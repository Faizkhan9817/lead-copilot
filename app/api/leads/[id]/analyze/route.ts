import { getLead } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { analyzeLead } from "@/lib/leads";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<"/api/leads/[id]/analyze">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ lead: await analyzeLead(await getLead(id)) });
  } catch (err) {
    return errorResponse(err);
  }
}
