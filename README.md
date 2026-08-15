# Twitcher 🐦

Upload a photo of a bird, and [Claude](https://www.anthropic.com/claude) tells you what it is — common name, scientific name, confidence level, and a couple of alternative guesses if it's not sure.

Built end-to-end with **[Claude Code](https://claude.com/product/claude-code)**, Anthropic's agentic CLI — every line of this app (both services, the auth wiring, the UI) came out of a conversation with Claude Code, including the architecture decisions and their trade-offs along the way. It's meant as a small, concrete demo of pairing Claude Code with Claude's own API, Next.js, and Express.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | [Next.js 16](https://nextjs.org) (App Router), TypeScript, [Tailwind CSS 4](https://tailwindcss.com) |
| Backend | [Express 5](https://expressjs.com), TypeScript |
| AI | [Claude API](https://platform.claude.com) — `claude-opus-5`, structured JSON-schema output |
| Auth | [Clerk](https://clerk.com) — public sign-up, JWT-based API auth |
| Database | [Supabase](https://supabase.com) — Postgres, tracks manual account approval |
| Dev tooling | `tsx` (API hot reload), ESLint, Turbopack |

## Architecture

This is deliberately **two separately deployable services**, not a single full-stack app, so it doubles as a demo of decoupled JWT auth:

```
┌──────────────┐   Clerk session JWT    ┌──────────────┐   Anthropic API key   ┌───────────┐
│   Browser    │ ───────────────────▶   │   web/       │ ─────────────────▶    │  Claude   │
│  (Twitcher)  │  signs in via Clerk    │  Next.js UI  │   (server-side,       │  Opus 5   │
└──────────────┘                        └──────┬───────┘    api/ only)         └───────────┘
                                                │
                                    Authorization: Bearer <JWT>
                                                │
                                                ▼
                                         ┌──────────────┐   service-role key   ┌───────────┐
                                         │   api/       │ ────────────────▶    │ Supabase  │
                                         │  Express API │                      │ (Postgres)│
                                         └──────────────┘                      └───────────┘
```

- **`web/`** — the Next.js frontend. Clerk gates every page (`auth.protect()`), and the browser fetches a short-lived Clerk session token (`useAuth().getToken()`) to send with each request. `/` also does a server-side `GET /me` call to decide whether to show the splash, the pending-approval screen, or the app itself.
- **`api/`** — a standalone Express API with zero dependency on Next.js or Clerk's frontend SDK. It verifies the incoming JWT itself, via the framework-agnostic `@clerk/backend` package, before calling Claude. Because it only cares about "is this a validly-signed token," it isn't tied to the Next.js login flow — any client that can present a valid JWT can call it.
- **Supabase** sits entirely behind `api/`, accessed only with the service-role key — the browser and `web/` never talk to it directly, and there's no Postgres RLS in play. It's the system of record for account approval today (`app_users` table), and the natural place to store per-identification results later (see [Possible next steps](#possible-next-steps)).
- CORS on the API is locked to known frontend origins, but **CORS isn't the security boundary** — token verification is. A non-browser client ignores CORS entirely; what actually stops unauthenticated use is `verifyToken()` rejecting the request.
- Both services fail closed: neither will boot without their required secrets configured.

## Features

- Drag-and-drop or click-to-browse image upload
- Species ID with confidence level and alternative candidates when Claude isn't certain
- Recognizes fictional/costumed birds (Big Bird, Woodstock, ...) and answers in character instead of just saying "not a bird"
- Responsive layout — upload and results side by side on desktop, stacked on mobile
- A small animated bird while Claude is thinking
- Click the logo to reset and identify another bird
- Public sign-up, but new accounts need manual approval before they can identify anything

## Getting started

Prerequisites: Node.js, an [Anthropic API key](https://console.anthropic.com/settings/keys), a [Clerk](https://dashboard.clerk.com) application, and a [Supabase](https://supabase.com) project.

### 1. Clerk

- Create a Clerk app. Sign-up is public (**Configure → Restrictions** should be off/allow sign-ups) — the approval gate below is what actually controls access, not Clerk itself.
- Grab the publishable key and secret key from **API Keys**.

### 2. Supabase

- Create a free Supabase project, then run this in the SQL editor to create the approvals table:

  ```sql
  create table app_users (
    clerk_user_id text primary key,
    email text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    approved_at timestamptz
  );

  -- No policies defined below on purpose: with RLS on and zero policies,
  -- PostgREST denies anon/authenticated access outright. The API's
  -- service-role key bypasses RLS regardless, so this only closes off
  -- access from anyone who ever obtained the anon/publishable key — belt
  -- and suspenders, since that key is never actually used or exposed
  -- anywhere in this app today.
  alter table app_users enable row level security;
  ```

- Grab the project URL and the **service-role key** (not the anon key) from **Settings → API**.
- Approving accounts is done at **`/admin`** in the web app (see [Admin access](#admin-access) below) — the Supabase table editor still works as a fallback if you'd rather edit `app_users` rows directly.
- Free tier auto-pauses a project after 7 days with no database activity — for an app used more than weekly this doesn't come up, but if it goes quiet, the next request just needs the project manually unpaused from the Supabase dashboard first.

### Admin access

`/admin` lists every signed-up account and lets you approve, reject, or reset their status — it's the normal way to approve people day to day. It's gated by Clerk's `privateMetadata`, not by anything in `app_users`, since admin-ness is a property of the account rather than part of the approval workflow: only a user with `privateMetadata.role === "admin"` can reach it (`api/src/middleware/admin.ts`). There's no dashboard toggle for this — set it via the Clerk Backend API:

```ts
await clerkClient.users.updateUserMetadata(clerkUserId, {
  privateMetadata: { role: "admin" },
});
```

`privateMetadata` is only ever readable from server-side Clerk API calls, never from the frontend SDK, so this can't leak to the browser.

### 3. API (`api/`)

```sh
cd api
cp .env.example .env   # fill in ANTHROPIC_API_KEY, CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev             # http://localhost:4000
```

### 4. Web (`web/`)

```sh
cd web
cp .env.example .env.local   # fill in the two Clerk keys + NEXT_PUBLIC_API_BASE_URL
npm install
npm run dev             # http://localhost:3000
```

Both `CLERK_SECRET_KEY` values must match — same Clerk app, verified independently by each service.

### Testing on another device (phone, etc.)

`next dev` and the Express server both already bind to your machine's LAN address, but two env vars are hardcoded to `localhost` by default and need updating to your LAN IP: `NEXT_PUBLIC_API_BASE_URL` in `web/.env.local`, and `ALLOWED_ORIGINS` in `api/.env` (comma-separate it alongside `localhost:3000` rather than replacing it). Restart both dev servers after changing either, then browse to `http://<your-LAN-IP>:3000` from the other device — not `localhost`. If Clerk's sign-in flow gets stuck in a redirect loop over a raw LAN IP, fall back to an `ngrok` tunnel for both ports instead.

## Custom domain

Twitcher runs on three subdomains of a single domain — substitute your own for `yourdomain.com` below:

| Subdomain | Points to | Why here, not under `twitcher.` |
|---|---|---|
| `twitcher.yourdomain.com` | Render — `twitcher-web` | The app itself |
| `api.yourdomain.com` | Render — `twitcher-api` | Kept at the domain root since this API could plausibly serve other projects later — though today it's a direct CNAME to this one service, not a shared gateway, so don't read more permanence into the name than exists yet |
| `clerk.yourdomain.com` | Clerk | Also at the root, so future projects on the same domain could share this same Clerk production instance (Clerk calls this pattern satellite domains) |

### Clerk: dev → production is a real migration, not a toggle

Clerk's dev and production instances are genuinely separate — going to production creates a *new* instance under the same application, and settings don't copy over automatically. Two things bit us here specifically, and would've been easy to miss:

- **`sign_up_mode` doesn't carry over between instances**, and defaults can differ from what dev was set to — worth explicitly checking (`clerk config pull --instance prod`) rather than assuming production matches dev.
- **Google sign-in needs its own production OAuth credentials**, which the dev instance doesn't require (it uses shared placeholder credentials). We left Google sign-in disabled in production rather than standing up a Google Cloud OAuth app for it — email/password is enough for an app gated by manual approval anyway.

The [Clerk CLI](https://clerk.com/docs/guides/development/deployment/production) (`npx clerk@latest`) is worth knowing about here — `clerk deploy status` reports exactly what's blocking production readiness (pending DNS records, unconfigured OAuth providers, etc.) as structured JSON, and `clerk config pull/patch --instance prod` can read and change instance settings like the two above directly, without going through the dashboard.

### DNS records

Each subdomain needs a CNAME at your DNS provider: `twitcher.yourdomain.com` and `api.yourdomain.com` point at whatever `*.onrender.com` target Render shows after adding the domain in each service's Settings; `clerk.yourdomain.com` (plus a couple of Clerk-managed mail/DKIM records) point at whatever the Clerk Dashboard's Domains page specifies.

## Deploying to Render

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) defining both services as one deploy, both explicitly on **`plan: free`** — leaving `plan` unset defaults to the paid Starter tier, so this is deliberate, not an oversight.

1. In the Render dashboard: **New → Blueprint**, connect this GitHub repo. Render reads `render.yaml` and proposes both `twitcher-api` and `twitcher-web`.
2. It'll prompt for each `sync: false` env var:

   | Service | Var | Value |
   |---|---|---|
   | `twitcher-web` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk production publishable key (`pk_live_...`) |
   | `twitcher-web` | `CLERK_SECRET_KEY` | Clerk production secret key (`sk_live_...`) |
   | `twitcher-web` | `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourdomain.com` |
   | `twitcher-api` | `CLERK_SECRET_KEY` | same production secret key as above |
   | `twitcher-api` | `ANTHROPIC_API_KEY` | same value as local `api/.env` |
   | `twitcher-api` | `SUPABASE_URL` | same value as local `api/.env` |
   | `twitcher-api` | `SUPABASE_SERVICE_ROLE_KEY` | same value as local `api/.env` |
   | `twitcher-api` | `ALLOWED_ORIGINS` | `https://twitcher.yourdomain.com` |

3. On each service, Settings → Add Custom Domain, then add the CNAME Render gives you at your DNS provider (see [Custom domain](#custom-domain) above).

Both `package.json`s already have `build`/`start` scripts matching what `render.yaml` runs, and a `.node-version` file pins each service to Node 24. `PORT` is set to `10000` in the blueprint to match what Render expects — both apps already read `process.env.PORT`, so nothing else to configure there. I ran the exact `npm run build && npm start` sequence locally on port 10000 before writing this to confirm both come up cleanly.

**Free tier, and what it actually costs:** $0, and it does support custom domains + managed TLS — no forced upgrade there. The trade-offs: each service spins down after 15 minutes with no traffic and takes 30–60s to cold-start back up on the next request (fine for a personal/demo app, not for something latency-sensitive); the account gets 750 free instance-hours/month shared across *all* free services, and a single service running 24/7 alone would already use ~730 of those — so if both `twitcher-web` and `twitcher-api` end up getting enough steady traffic to stay constantly awake, you'd bump into that shared cap before the month is out. For occasional personal use (which is what spin-down is for) this comfortably fits; if it ever needs to stay warm full-time, Starter is $7/service/month.

## Why Opus 5

The model is `claude-opus-5`. It started out on `claude-haiku-4-5` — the cheapest current Claude tier — on the theory that bird ID from a photo is a bounded classification task that wouldn't benefit much from a larger model. In practice, Haiku misidentified some harder photos (a wasp photographed near a roof, read as a house sparrow), so this trades a higher per-request cost for meaningfully better vision accuracy. Structured output is enforced via `output_config.format` (JSON schema), so the response is always parseable — no prompt-and-pray JSON extraction.

## Project layout

```
twitcher/
├── web/     Next.js frontend (Clerk auth, upload UI)
└── api/     Express API (JWT verification, Claude calls)
```

## Possible next steps

- A machine-to-machine ingestion route (e.g. for a security camera / NVR like Frigate to submit snapshots automatically) — that'd use a separate static-secret check rather than Clerk JWTs, since there's no human signing in
- An admin-configurable model setting, so the Claude model used for identification can be changed without a code deploy
- Storing each identification (image + result) in Supabase, so a "your last N matches" / "top 5 matches" view becomes possible

---

Built with [Claude Code](https://claude.com/product/claude-code).
