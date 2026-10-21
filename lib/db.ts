import "server-only"; // build fails if a client component ever imports this file (it holds the service key)
import { createClient } from "@supabase/supabase-js";
import type { Lead, LeadEvent, LeadInput } from "./schemas";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Database not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Supabase returns { data, error }; turn errors into thrown exceptions so routes can catch one way.
function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Database error: ${res.error.message}`);
  return res.data as T;
}

export async function getLeads(): Promise<Lead[]> {
  return check(await db().from("leads").select("*").order("score", { ascending: false, nullsFirst: false }));
}

export async function getLead(id: string): Promise<Lead> {
  return check(await db().from("leads").select("*").eq("id", id).single());
}

export async function createLead(input: LeadInput & Partial<Lead>): Promise<Lead> {
  const lead: Lead = check(await db().from("leads").insert(input).select().single());
  await addEvent(lead.id, "created", "Lead added");
  return lead;
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead> {
  return check(await db().from("leads").update(patch).eq("id", id).select().single());
}

export async function deleteAllLeads(): Promise<void> {
  // Supabase refuses an unfiltered delete, so match every row explicitly. Events cascade.
  check(await db().from("leads").delete().not("id", "is", null));
}

export async function addEvent(leadId: string, type: LeadEvent["type"], detail = ""): Promise<void> {
  check(await db().from("events").insert({ lead_id: leadId, type, detail }));
}

export async function getEvents(leadId: string): Promise<LeadEvent[]> {
  return check(await db().from("events").select("*").eq("lead_id", leadId).order("created_at"));
}
