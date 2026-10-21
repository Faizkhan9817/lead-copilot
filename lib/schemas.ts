import { z } from "zod";

// What the analysis prompt must return. Zod checks the model's JSON against this.
export const AnalysisSchema = z.object({
  summary: z.string().min(1),
  intent: z.string().min(1),
  key_requirements: z.array(z.string()).max(8),
  objections: z.array(z.string()).max(6),
  next_action: z.string().min(1),
  suggested_response: z.string().min(1),
  score: z.number().int().min(0).max(100),
  tag: z.enum(["hot", "warm", "cold"]),
  urgency: z.enum(["high", "medium", "low"]),
  score_reasons: z.array(z.string()).min(1).max(4),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// Before the call: fits on one screen.
export const CallPrepSchema = z.object({
  talking_points: z.array(z.string()).length(3),
  questions: z.array(z.string()).length(2),
  objections: z.array(z.object({ objection: z.string(), rebuttal: z.string() })).min(1).max(3),
});
export type CallPrep = z.infer<typeof CallPrepSchema> & { created_at: string };

// After the call: what the AI extracts from the salesperson's notes.
// It returns a number of days, not a date: the code does the date math (LLMs are unreliable at it).
export const CallOutcomeSchema = z.object({
  summary: z.string().min(1),
  score: z.number().int().min(0).max(100),
  urgency: z.enum(["high", "medium", "low"]),
  score_reasons: z.array(z.string()).min(1).max(4),
  commitments: z.array(z.string()).max(6),
  next_steps: z.array(z.string()).min(1).max(5),
  follow_up_in_days: z.number().int().min(0).max(60),
  follow_up_reason: z.string().min(1),
  follow_up_message: z.string().min(1),
});
export type CallOutcome = z.infer<typeof CallOutcomeSchema>;
export type LastCall = CallOutcome & { notes: string; score_before: number | null; created_at: string };

export type ChatMessage = { role: "user" | "assistant"; content: string };

// The fields a salesperson fills in on the intake form.
export const LeadInputSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(100),
  location: z.string().trim().max(200).default(""),
  requirement: z.string().trim().max(500).default(""),
  budget: z.string().trim().max(100).default(""),
  timeline: z.string().trim().max(100).default(""),
  message: z.string().trim().max(20000).default(""),
});
export type LeadInput = z.infer<typeof LeadInputSchema>;

// One row of the `leads` table, as the app sees it.
export type Lead = LeadInput & {
  id: string;
  created_at: string;
  analysis: Analysis | null;
  score: number | null;
  tag: Analysis["tag"] | null;
  urgency: Analysis["urgency"] | null;
  call_prep: CallPrep | null;
  last_call: LastCall | null;
  follow_up_date: string | null; // YYYY-MM-DD
  follow_up_status: "none" | "pending" | "done";
  chat: ChatMessage[];
};

// Local date as YYYY-MM-DD (en-CA happens to format dates that way).
export const todayISO = () => new Date().toLocaleDateString("en-CA");

// Computed on read, never stored, so it can't go stale (see DECISIONS.md #3).
export function isFollowUpDue(lead: Lead): boolean {
  return lead.follow_up_status === "pending" && !!lead.follow_up_date && lead.follow_up_date <= todayISO();
}

export type LeadEvent = {
  id: string;
  lead_id: string;
  created_at: string;
  type: "created" | "analyzed" | "call_notes" | "follow_up_scheduled" | "follow_up_done";
  detail: string;
};
