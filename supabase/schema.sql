-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  -- Intake form
  name             text not null,
  location         text not null default '',
  requirement      text not null default '',
  budget           text not null default '',   -- free text ("1.2 Cr", "80L-1Cr"): the AI judges realism
  timeline         text not null default '',
  message          text not null default '',

  -- AI analysis. score/tag/urgency are columns (not only in the JSON) so we can sort on them.
  analysis         jsonb,
  score            int check (score between 0 and 100),
  tag              text check (tag in ('hot', 'warm', 'cold')),
  urgency          text check (urgency in ('high', 'medium', 'low')),

  -- Call prep and post-call feature
  call_prep        jsonb,
  last_call        jsonb,
  follow_up_date   date,
  follow_up_status text not null default 'none' check (follow_up_status in ('none', 'pending', 'done')),

  -- This lead's chat history: [{ "role": "user" | "assistant", "content": "..." }]
  chat             jsonb not null default '[]'::jsonb
);

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  type       text not null,   -- created | analyzed | call_notes | follow_up_scheduled
  detail     text not null default ''
);

create index if not exists events_lead_id_idx on events(lead_id, created_at);

-- The app only talks to Supabase from the server with the service-role key.
-- Enabling RLS with no policies means the public anon key can read/write nothing.
alter table leads  enable row level security;
alter table events enable row level security;
