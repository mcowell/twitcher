# Twitcher 🐦

Upload a photo of a bird, and [Claude](https://www.anthropic.com/claude) tells you what it is — common name, scientific name, confidence level, and a couple of alternative guesses if it's not sure.

Built end-to-end with **[Claude Code](https://claude.com/product/claude-code)**, Anthropic's agentic CLI — every line of this app (both services, the auth wiring, the UI) came out of a conversation with Claude Code, including the architecture decisions and their trade-offs along the way. It's meant as a small, concrete demo of pairing Claude Code with Claude's own API, Next.js, and Express.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | [Next.js 16](https://nextjs.org) (App Router), TypeScript, [Tailwind CSS 4](https://tailwindcss.com) |
| Backend | [Express 5](https://expressjs.com), TypeScript |
| AI | [Claude API](https://platform.claude.com) — `claude-haiku-4-5`, structured JSON-schema output |
| Auth | [Clerk](https://clerk.com) — invite-only sign-up, JWT-based API auth |
| Dev tooling | `tsx` (API hot reload), ESLint, Turbopack |

## Architecture

This is deliberately **two separately deployable services**, not a single full-stack app, so it doubles as a demo of decoupled JWT auth:

```
┌──────────────┐   Clerk session JWT    ┌──────────────┐   Anthropic API key   ┌───────────┐
│   Browser    │ ───────────────────▶   │   web/       │ ─────────────────▶    │  Claude   │
│  (Twitcher)  │  signs in via Clerk    │  Next.js UI  │   (server-side,        │  Haiku 4.5│
└──────────────┘                        └──────┬───────┘    api/ only)         └───────────┘
                                                │
                                    Authorization: Bearer <JWT>
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │   api/       │
                                         │  Express API │
                                         └──────────────┘
```

- **`web/`** — the Next.js frontend. Clerk gates every page (`auth.protect()`), and the browser fetches a short-lived Clerk session token (`useAuth().getToken()`) to send with each request.
- **`api/`** — a standalone Express API with zero dependency on Next.js or Clerk's frontend SDK. It verifies the incoming JWT itself, via the framework-agnostic `@clerk/backend` package, before calling Claude. Because it only cares about "is this a validly-signed token," it isn't tied to the Next.js login flow — any client that can present a valid JWT can call it.
- CORS on the API is locked to known frontend origins, but **CORS isn't the security boundary** — token verification is. A non-browser client ignores CORS entirely; what actually stops unauthenticated use is `verifyToken()` rejecting the request.
- Both services fail closed: neither will boot without their required secrets configured.

## Features

- Drag-and-drop or click-to-browse image upload
- Species ID with confidence level and alternative candidates when Claude isn't certain
- Recognizes fictional/costumed birds (Big Bird, Woodstock, ...) and answers in character instead of just saying "not a bird"
- Responsive layout — upload and results side by side on desktop, stacked on mobile
- A small animated bird while Claude is thinking
- Click the logo to reset and identify another bird
- Invite-only access — no public sign-up

## Getting started

Prerequisites: Node.js, an [Anthropic API key](https://console.anthropic.com/settings/keys), and a [Clerk](https://dashboard.clerk.com) application.

### 1. Clerk

- Create a Clerk app, then go to **Configure → Restrictions** and enable **Restricted mode** — this is what makes sign-up invite-only.
- Invite yourself (and anyone else) from **Users → Invitations**.
- Grab the publishable key, secret key from **API Keys**.

### 2. API (`api/`)

```sh
cd api
cp .env.example .env   # fill in ANTHROPIC_API_KEY and CLERK_SECRET_KEY
npm install
npm run dev             # http://localhost:4000
```

### 3. Web (`web/`)

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

- **Restricted (invite-only) mode had to be re-enabled on production.** The dev instance had it on; the fresh production instance defaulted back to public sign-up. Skipping this would have silently undone the entire point of using Clerk in this project.
- **Google sign-in needed its own production OAuth credentials**, which the dev instance doesn't require (it uses shared placeholder credentials). Since this app is invite-only anyway, we disabled Google sign-in in production rather than standing up a Google Cloud OAuth app for it.

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
   | `twitcher-api` | `ALLOWED_ORIGINS` | `https://twitcher.yourdomain.com` |

3. On each service, Settings → Add Custom Domain, then add the CNAME Render gives you at your DNS provider (see [Custom domain](#custom-domain) above).

Both `package.json`s already have `build`/`start` scripts matching what `render.yaml` runs, and a `.node-version` file pins each service to Node 24. `PORT` is set to `10000` in the blueprint to match what Render expects — both apps already read `process.env.PORT`, so nothing else to configure there. I ran the exact `npm run build && npm start` sequence locally on port 10000 before writing this to confirm both come up cleanly.

**Free tier, and what it actually costs:** $0, and it does support custom domains + managed TLS — no forced upgrade there. The trade-offs: each service spins down after 15 minutes with no traffic and takes 30–60s to cold-start back up on the next request (fine for a personal/demo app, not for something latency-sensitive); the account gets 750 free instance-hours/month shared across *all* free services, and a single service running 24/7 alone would already use ~730 of those — so if both `twitcher-web` and `twitcher-api` end up getting enough steady traffic to stay constantly awake, you'd bump into that shared cap before the month is out. For occasional personal use (which is what spin-down is for) this comfortably fits; if it ever needs to stay warm full-time, Starter is $7/service/month.

## Why Haiku, and why no `effort`

The model is `claude-haiku-4-5` — the cheapest current Claude tier — with no extended thinking and a small `max_tokens`. Bird ID from a photo is a bounded classification task, not open-ended reasoning, so it doesn't benefit much from a larger model or deeper thinking, and keeping cost per request low mattered for a demo app anyone could hit repeatedly. Structured output is enforced via `output_config.format` (JSON schema), so the response is always parseable — no prompt-and-pray JSON extraction.

## Project layout

```
twitcher/
├── web/     Next.js frontend (Clerk auth, upload UI)
└── api/     Express API (JWT verification, Claude calls)
```

## Possible next steps

- A machine-to-machine ingestion route (e.g. for a security camera / NVR like Frigate to submit snapshots automatically) — that'd use a separate static-secret check rather than Clerk JWTs, since there's no human signing in
- Swap in a different model tier if accuracy on tricky species needs to beat cost

---

Built with [Claude Code](https://claude.com/product/claude-code).
