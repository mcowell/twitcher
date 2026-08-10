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

## Why Haiku, and why no `effort`

The model is `claude-haiku-4-5` — the cheapest current Claude tier — with no extended thinking and a small `max_tokens`. Bird ID from a photo is a bounded classification task, not open-ended reasoning, so it doesn't benefit much from a larger model or deeper thinking, and keeping cost per request low mattered for a demo app anyone could hit repeatedly. Structured output is enforced via `output_config.format` (JSON schema), so the response is always parseable — no prompt-and-pray JSON extraction.

## Project layout

```
twitcher/
├── web/     Next.js frontend (Clerk auth, upload UI)
└── api/     Express API (JWT verification, Claude calls)
```

## Possible next steps

- Deploy both services to [Render](https://render.com)
- A machine-to-machine ingestion route (e.g. for a security camera / NVR like Frigate to submit snapshots automatically) — that'd use a separate static-secret check rather than Clerk JWTs, since there's no human signing in
- Swap in a different model tier if accuracy on tricky species needs to beat cost

---

Built with [Claude Code](https://claude.com/product/claude-code).
