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

export type ChatMessage = { role: "user" | "assistant"; content: string };

// The fields a salesperson fills in on the intake form.
export const LeadInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
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
  call_prep: unknown | null; // typed in step 5
  last_call: unknown | null; // typed in step 5
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
  type: "created" | "analyzed" | "call_notes" | "follow_up_scheduled";
  detail: string;
};
