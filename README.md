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
- A "recently identified" strip showing your last 4 matches, thumbnail and all — "See all" leads to `/history`, every bird you've personally identified with a brief write-up per card and a full detail page (bigger image, full explanation, alternative possibilities) on click
- Public sign-up, but new accounts need manual approval before they can identify anything
- Admins get emailed the moment a new account needs approval
- A Frigate NVR integration for bird-feeder cameras: detections land in a review queue instead of being auto-identified, so you approve (or bulk-delete test/garbage) what actually gets sent to Claude
- A full identification history at `/admin`, across every user, with bulk delete for database cleanup
- A storage stat on `/admin` — image count and space used against Supabase's free-tier quota, so you can see it coming before it's a surprise

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

- Then this, to store each identification (image + result) for the "recently identified" strip:

  ```sql
  create table identifications (
    id uuid primary key default gen_random_uuid(),
    clerk_user_id text not null references app_users(clerk_user_id),
    image_path text not null,
    is_bird boolean not null,
    is_fictional_or_costume boolean not null,
    common_name text not null,
    scientific_name text not null,
    confidence text not null check (confidence in ('low', 'medium', 'high')),
    description text not null,
    alternative_possibilities jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
  );
  create index identifications_clerk_user_id_created_at_idx on identifications (clerk_user_id, created_at desc);
  alter table identifications enable row level security;
  ```

- And this, for the Frigate review queue (see [Frigate ingestion](#frigate-ingestion) below):

  ```sql
  create table staged_images (
    id uuid primary key default gen_random_uuid(),
    image_path text not null,
    camera text,
    event_id text,
    score numeric,
    created_at timestamptz not null default now()
  );
  alter table staged_images enable row level security;
  ```

- And create two **private** Storage buckets: `bird-images` and `staged-images` (Storage → New bucket, leave "Public bucket" off both times). Images are served to the browser via short-lived signed URLs generated server-side, never a public bucket URL.
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

### New-signup email notifications

`/admin` also has a small "Notify on new signups" panel — add or remove email addresses, and each one gets emailed the moment a new account signs up and lands in `pending` (see `notifyAdminsOfNewSignup` in `api/src/services/appUsers.ts`, fired best-effort from the same lazy-create-on-first-sight path that creates the `app_users` row). The list itself lives in a `notification_emails` table:

```sql
create table notification_emails (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table notification_emails enable row level security;
```

Sending goes through **Fastmail's SMTP relay** (`smtp.fastmail.com:587`, via `nodemailer`) rather than a dedicated transactional-email provider — volume here is at most a handful of emails a month, well under any sending limit, and routing through an address Fastmail already hosts means its existing SPF/DKIM covers deliverability with zero extra DNS setup. To set this up:

1. In Fastmail, add the address you want to send from as an alias (**Settings → Addresses**) if it isn't a full mailbox already — e.g. `notify@yourdomain.com`, kept separate from any real inbox.
2. Generate an app password scoped to **Mail/SMTP only** (**Settings → Password & Security → App Passwords**) — not your account password.
3. Set `SMTP_USER` (your Fastmail login), `SMTP_PASSWORD` (the app password), and `NOTIFICATION_FROM_EMAIL` (the alias from step 1) in `api/.env`.

### Frigate ingestion

A [Frigate](https://frigate.video) NVR watching a bird feeder can easily produce hundreds of detections a day, most of them the same few birds visiting repeatedly — sending every one to Claude would be wasteful and mostly redundant. So there's a staging step instead of a direct pipe to `/identify`:

```
Frigate (MQTT) → frigate-relay/ (your network) → POST /ingest/frigate → staged_images
                                                                              │
                                              /admin/queue (approve/delete) ─┘
```

- **`frigate-relay/`** is a standalone Python service — not part of `web`/`api`, meant to run on your own network (a Synology via Container Manager, in this project's case) rather than deployed alongside the rest of the app, since it needs local access to Frigate's MQTT broker and HTTP API. It subscribes to Frigate's `<topic_prefix>/events` MQTT topic, and for each finalized bird detection (`type: "end"`, `label: "bird"`) — after a per-camera cooldown (`COOLDOWN_MINUTES`, default 15) skips repeat visits from the same camera — fetches the snapshot with `?bbox=0` (Frigate's own bounding-box overlay stripped out, since a box drawn over the bird is worse input for identification than a clean photo) and POSTs it to `POST /ingest/frigate`. See `frigate-relay/README.md` for setup, including the dedicated read-scoped MQTT user this expects rather than reusing Frigate's own broker login.
- **`POST /ingest/frigate`** is authenticated with a static shared secret (`FRIGATE_INGEST_SECRET`), not a Clerk JWT — there's no human signing in on this path, just a script on your own network, so a session-based token doesn't apply (`api/src/middleware/ingestAuth.ts`, compared with `crypto.timingSafeEqual`). It crops the image to the bird's bounding box (forwarded from Frigate as-is by the relay; the crop math itself lives here, not in Python, so it's actually testable) before storing it in the `staged-images` bucket and a row in `staged_images` — no Claude call yet. The crop pads the box by 75% of its own width/height on each side (`api/src/services/imageCrop.ts`), so the result keeps real surrounding context rather than being razor-tight, but is still a small fraction of Frigate's full wide-angle frame — with a 500px minimum so a small/distant detection's tiny box doesn't get padded into another tiny, low-detail crop.
- **`/admin/queue`** lists everything staged, with checkboxes (including "select all") for bulk actions: **Approve** runs identification on just the selected images and — for real bird sightings — saves them into the same `identifications` table as any other identification, attributed to whichever admin clicked Approve; **Delete** removes selected images without ever calling Claude, which is the point of the whole staging step — test/garbage detections can be cleared out for free.

### Identification history

The home page's "recently identified" strip only shows the last 3. Two fuller views build on the same paginated `limit`/`offset` pattern:

- **`/history`** (any approved user) — everything *that user* has personally identified, browsable with "Load more" and a detail page per bird (`/history/[id]`, ownership-checked server-side so one user can't view another's by guessing an id) with the full write-up and alternative possibilities. Read-only — no delete.
- **`/admin/history`** (admin-only) — every identification across *every* user, each one showing who it's attributed to, with the same multi-select-and-bulk-delete pattern as the Frigate queue, for general database cleanup (e.g. a Frigate misfire that got approved by mistake) rather than pre-Claude triage.

There's no automatic retention policy yet (delete-after-X-days or keep-last-X) — for now, cleanup is manual at `/admin/history`.

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

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec) defining both services as one deploy, both explicitly on **`plan: starter`** (see [Free tier vs. Starter](#free-tier-vs-starter) below for why, and for the free-tier alternative). Set `plan` explicitly either way — leaving it unset defaults to paid Starter, so an unset `plan` isn't the same as choosing free.

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
   | `twitcher-api` | `SMTP_USER` | same value as local `api/.env` |
   | `twitcher-api` | `SMTP_PASSWORD` | same value as local `api/.env` |
   | `twitcher-api` | `NOTIFICATION_FROM_EMAIL` | same value as local `api/.env` |
   | `twitcher-api` | `FRIGATE_INGEST_SECRET` | same value as local `api/.env` (and `frigate-relay`'s `INGEST_SECRET`) |
   | `twitcher-api` | `ALLOWED_ORIGINS` | `https://twitcher.yourdomain.com` |

3. On each service, Settings → Add Custom Domain, then add the CNAME Render gives you at your DNS provider (see [Custom domain](#custom-domain) above).

Both `package.json`s already have `build`/`start` scripts matching what `render.yaml` runs, and a `.node-version` file pins each service to Node 24. `PORT` is set to `10000` in the blueprint to match what Render expects — both apps already read `process.env.PORT`, so nothing else to configure there. I ran the exact `npm run build && npm start` sequence locally on port 10000 before writing this to confirm both come up cleanly.

### Free tier vs. Starter

Free tier costs $0 and still supports custom domains + managed TLS — no forced upgrade there. The trade-offs: each service spins down after 15 minutes with no traffic and takes 30–60s to cold-start back up on the next request; the account gets 750 free instance-hours/month shared across *all* free services, and a single service running 24/7 alone would already use ~730 of those — so if both `twitcher-web` and `twitcher-api` end up getting enough steady traffic to stay constantly awake, you'd bump into that shared cap before the month is out.

That cold start isn't just slow — while a service is asleep, Render can serve an HTML gateway page in place of a JSON response, which is survivable (the frontend shows a "waking up" message rather than crashing — see `web/src/app/service-unavailable.tsx`) but is still a bad first impression for a real visitor, not just an internal demo. Once there are actual invited users rather than just yourself testing, that's the point where free tier's UX cost stops being worth $0/month: this app now runs both services on **Starter ($7/service/month, $14/month total)** for exactly that reason. `plan: free` in `render.yaml` is still a completely reasonable choice if you're the only user or don't mind occasional cold starts — just change both `plan: starter` lines back to `plan: free` before deploying your own copy.

## Why Opus 5

The model is `claude-opus-5`. It started out on `claude-haiku-4-5` — the cheapest current Claude tier — on the theory that bird ID from a photo is a bounded classification task that wouldn't benefit much from a larger model. In practice, Haiku misidentified some harder photos (a wasp photographed near a roof, read as a house sparrow), so this trades a higher per-request cost for meaningfully better vision accuracy. Structured output is enforced via `output_config.format` (JSON schema), so the response is always parseable — no prompt-and-pray JSON extraction.

## Project layout

```
twitcher/
├── web/            Next.js frontend (Clerk auth, upload UI)
├── api/            Express API (JWT verification, Claude calls, Frigate ingestion)
└── frigate-relay/  Standalone Python service — runs on your own network, not deployed with the rest
```

## Possible next steps

- An admin-configurable model setting, so the Claude model used for identification can be changed without a code deploy
- Automatic retention (delete identifications after X days, or beyond the most recent X) instead of only manual cleanup at `/admin/history`

---

Built with [Claude Code](https://claude.com/product/claude-code).
