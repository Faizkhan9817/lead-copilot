# Setup and deployment

Everything here uses free tiers and needs no credit card. Total time is about 15 minutes.

## 1. Supabase (database)
1. Go to https://supabase.com/dashboard and click **New project**.
   - Choose a name and a database password.
   - Pick the region closest to your users (e.g. Mumbai).
2. Open **SQL Editor** → **New query**, paste all of [`supabase/schema.sql`](../supabase/schema.sql) and click **Run**. You should see "Success. No rows returned".
3. Check **Table Editor**: `leads` and `events` should exist.
4. Copy two values:
   - **Project URL:** under Project Settings → Data API, e.g. `https://abcd.supabase.co`. This is `SUPABASE_URL`.
   - **Server key:** under Project Settings → API Keys, use the **secret** key (`sb_secret_…`), or on older projects the legacy **service_role** key. This is `SUPABASE_SERVICE_ROLE_KEY`.
   - **Don't use** the anon / publishable key.

> You can use the same Supabase project for local development and production. It's one shared demo database either way.

## 2. AI keys
| Provider | Get a key | Variable |
|---|---|---|
| Google Gemini | https://aistudio.google.com/apikey → **Create API key** | `GEMINI_API_KEY` |
| Groq (fallback) | https://console.groq.com/keys → **Create API Key** (shown only once) | `GROQ_API_KEY` |

Model names are also environment variables: `GEMINI_MODEL=gemini-3.8-flash`, `GROQ_MODEL=openai/gpt-oss-120b`. If a provider retires a model, list the models your key can use and change the variable; no code change is needed:
```bash
curl -s -H "x-goog-api-key: $GEMINI_API_KEY" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"
```
```bash
curl -s -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
```

## 3. Run locally
```bash
cp .env.example .env.local
```
Fill in the 4 keys, then:
```bash
npm install
```
```bash
npm run dev
```
Open http://localhost:3000 and click **Load samples**.

## 4. Push to a public GitHub repo
From the `lead-copilot` folder, with the GitHub CLI logged in:
```bash
gh repo create lead-copilot --public --source=. --remote=origin --push
```
Or without the CLI: create an empty **public** repo on github.com, then:
```bash
git remote add origin https://github.com/<you>/lead-copilot.git
```
```bash
git push -u origin main
```
Before pushing, check that no secrets are tracked. This should print only `.env.example`:
```bash
git ls-files | grep -i env
```

## 5. Deploy on Vercel
1. Go to https://vercel.com/new and sign in with GitHub. **Import** the `lead-copilot` repo.
2. The framework is detected as **Next.js**. Leave the build settings at their defaults.
3. Open **Environment Variables** and add all 6, for **Production** (and Preview if you like):
   - `GEMINI_API_KEY`, `GEMINI_MODEL`
   - `GROQ_API_KEY`, `GROQ_MODEL`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**. It takes about 1 minute.
5. Open the URL and click **Load samples** once, so reviewers see a full app.

> If you add or change environment variables after deploying, use **Deployments → ⋯ → Redeploy**. Variables only apply to new builds.

## 6. Verify the live URL
- [ ] Open the URL in an **incognito window**. The app loads with no login and no extension interference.
- [ ] Sample leads are visible, and **Follow-ups due** shows Arjun Mehta.
- [ ] **+ New lead**: submit a lead and see the analysis appear within about 15 s.
- [ ] **Call** tab: generate call prep, then process some call notes. The score changes and a follow-up date appears.
- [ ] **Chat** tab: the answer streams in, and "What's the capital of France?" is declined.
- [ ] **Activity** tab shows the timeline with "via gemini" (or "via groq").
- [ ] Open the repo URL in incognito. It's **public**, and the README renders with the architecture diagram.
- [ ] In the browser's DevTools Network tab, no request goes to Gemini, Groq or Supabase directly. Everything goes through `/api/...`.
- [ ] Search the repo on GitHub for `sb_secret` and `AIza`: there should be no results.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Database not configured" | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing in Vercel. Add it, then redeploy |
| "Database error: relation leads does not exist" | Run `supabase/schema.sql` in the SQL Editor |
| "Both Gemini and Groq failed" | Check the keys. Check the Vercel function logs for `[ai]` lines. A 404 means the model was retired: change `GEMINI_MODEL` / `GROQ_MODEL` |
| Timeline often says "via groq" | Gemini's free tier is rate-limiting (429). That's expected under bursts; the fallback is doing its job |
| Load samples is slow (30–60 s) | Normal: 7 real AI calls, run 2 at a time so Groq's free per-minute limit isn't hit. The seed route allows up to 120 s |
