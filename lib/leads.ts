import "server-only";
import { generateJson } from "./ai";
import { addEvent, updateLead } from "./db";
import { analysisMessages, callNotesMessages, callPrepMessages } from "./prompts";
import { AnalysisSchema, CallOutcomeSchema, CallPrepSchema, type Analysis, type Lead } from "./schemas";

// Business logic that combines an AI call with saving the result. Routes stay thin and call these.

// The tag is derived from the score in code, so "score 35 but tagged hot" can never happen.
export function tagFromScore(score: number): Analysis["tag"] {
  return score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
}

// YYYY-MM-DD, n days from today in India time (negative = in the past).
export function dateInDays(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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

export async function generateCallPrep(lead: Lead): Promise<Lead> {
  const { data } = await generateJson(CallPrepSchema, callPrepMessages(lead));
  return updateLead(lead.id, { call_prep: { ...data, created_at: new Date().toISOString() } });
}

// After a call: re-score, extract commitments/next steps, schedule the follow-up, draft the message.
// `followUpDate` overrides the AI's choice; only the seed data uses it, to create an overdue follow-up.
export async function processCallNotes(lead: Lead, notes: string, followUpDate?: string): Promise<Lead> {
  const { data, provider } = await generateJson(CallOutcomeSchema, callNotesMessages(lead, notes));
  const tag = tagFromScore(data.score);
  const date = followUpDate ?? dateInDays(data.follow_up_in_days);

  const updated = await updateLead(lead.id, {
    last_call: { ...data, notes, score_before: lead.score, created_at: new Date().toISOString() },
    score: data.score,
    tag,
    urgency: data.urgency,
    // Keep the analysis card in sync with the new score; its next action becomes the first next step.
    analysis: lead.analysis && {
      ...lead.analysis,
      score: data.score,
      tag,
      urgency: data.urgency,
      score_reasons: data.score_reasons,
      next_action: data.next_steps[0],
    },
    call_prep: null, // the old prep was for the call that just happened
    follow_up_date: date,
    follow_up_status: "pending",
  });

  const change = lead.score === null ? `${data.score}` : `${lead.score} → ${data.score}`;
  await addEvent(lead.id, "call_notes", `Call logged. Score ${change} (${tag}) via ${provider}`);
  await addEvent(lead.id, "follow_up_scheduled", `Follow-up on ${date}: ${data.follow_up_reason}`);
  return updated;
}
