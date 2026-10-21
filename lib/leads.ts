import "server-only";
import { generateJson } from "./ai";
import { addEvent, updateLead } from "./db";
import { analysisMessages } from "./prompts";
import { AnalysisSchema, type Analysis, type Lead } from "./schemas";

// Business logic that combines an AI call with saving the result. Routes stay thin and call these.

// The tag is derived from the score in code, so "score 35 but tagged hot" can never happen.
export function tagFromScore(score: number): Analysis["tag"] {
  return score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
}

export async function analyzeLead(lead: Lead): Promise<Lead> {
  const { data, provider } = await generateJson(AnalysisSchema, analysisMessages(lead));
  const tag = tagFromScore(data.score);
  const updated = await updateLead(lead.id, {
    analysis: { ...data, tag },
    score: data.score,
    tag,
    urgency: data.urgency,
  });
  await addEvent(lead.id, "analyzed", `Scored ${data.score} (${tag}, ${data.urgency} urgency) via ${provider}`);
  return updated;
}
