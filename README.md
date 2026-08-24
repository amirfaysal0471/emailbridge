# MailBridge

A standalone Gmail integration demo — **React + Vite + shadcn/ui** on the front,
**Node + Express + TypeScript** behind it. Connect a Gmail account through Google
OAuth 2.0, read the inbox and sent mail, and compose, reply and forward, with
every outgoing message sent through the Gmail API **as the connected account**.

Built as a reference implementation: no user registration, no database, no
production deployment — just the OAuth and Gmail API integration, cleanly
separated so it can be lifted into an existing application.

---

## What it does

| | |
|---|---|
| **Connect** | One button → Google consent → the account is identified via `users.getProfile` and stored server-side |
| **Account panel** | "Connected Gmail" card in the sidebar showing the authorized address, with **Disconnect Gmail** |
| **Inbox** | Sender, recipient, subject, date, snippet, unread state, attachments, pagination, search, refresh |
| **Read** | Full body rendered safely, with attachment download |
| **Sent** | The same list and reader over the Sent mailbox |
| **Compose** | To / Cc / Bcc / Subject / Body → sent via Gmail API |
| **Reply** | Stays on the original Gmail thread, with reply-all and quoting |
| **Forward** | Standard forwarded-message block, optional note on top |
| **Rich compose** | Formatting toolbar (bold, italic, lists, quotes, links) sending a proper HTML + plain-text message |
| **Attachments** | Send up to 5 files / 25 MB, and download attachments from received mail |
| **Labels** | Sidebar lists every Gmail label with live unread counts; click one to filter |
| **Star / unread / trash** | One-click actions with optimistic UI and an Undo on trash |
| **Dark mode** | Light / dark / system, including the email body renderer |
| **Shortcuts** | `c` compose · `g i` inbox · `g s` sent · `/` search · `r` refresh · `?` help |
| **Disconnect** | Revokes the grant at Google and deletes the stored tokens |

### API surface

```
GET  /api/auth/google              GET  /api/gmail/profile
GET  /api/auth/google/callback     GET  /api/gmail/labels
GET  /api/auth/status              GET  /api/gmail/inbox?pageToken=…&labelId=…
POST /api/auth/disconnect          GET  /api/gmail/sent?pageToken=…
                                   GET  /api/gmail/messages/:messageId
                                   POST /api/gmail/messages/:messageId/star
                                   POST /api/gmail/messages/:messageId/read
                                   POST /api/gmail/messages/:messageId/trash
                                   POST /api/gmail/messages/:messageId/untrash
                                   POST /api/gmail/send
                                   POST /api/gmail/reply/:messageId
                                   POST /api/gmail/forward/:messageId
```

Full request and response shapes in [docs/api.md](docs/api.md).

**The From address is always the connected Gmail account.** There is no SMTP
transport in this project — nothing to misconfigure into sending from a server
address.

---

## Requirements

- **Node.js 20+** (developed on 22)
- A Google account you can use to create a Cloud project

## Setup

### 1. Google Cloud

Follow **[docs/google-cloud-setup.md](docs/google-cloud-setup.md)** — create a
project, enable the Gmail API, configure the consent screen and scopes, add
yourself as a test user, and create a Web application OAuth client with the
redirect URI `http://localhost:4000/api/auth/google/callback`.

Keep the **Client ID** and **Client secret** for the next step.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```ini
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
SESSION_SECRET=<openssl rand -hex 32>
```

Generate the session secret with:

```bash
openssl rand -hex 32
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
```

No edits needed — the default `VITE_API_BASE_URL=/api` uses the Vite dev proxy,
which keeps the browser and API same-origin so the session cookie works without
any CORS credential juggling.

## Run

From the repository root, both apps at once:

```bash
npm install && npm run dev
```

Or in two terminals:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

- Frontend → <http://localhost:5173>
- API → <http://localhost:4000/api/health>

Open the frontend and click **Connect Gmail**.

## Demo script

The flow to walk a client through, end to end:

1. **Connect Gmail** → Google consent screen → back to a populated inbox.
2. Open a received message — sender, recipients, date, body and attachments.
3. **Reply** → send → confirm it arrives, and that Gmail threads it under the original.
4. **Forward** the same message to another address.
5. **Compose** a new message with Cc, Bcc, formatted text and an attachment → send.
6. Switch to **Sent** → the new messages are there.
7. Check the recipient's mailbox: the `From` line is the connected Gmail address.
8. Open **Gmail itself** in another tab — the same messages are in the real Sent folder.
9. **Disconnect** from the account menu → the app returns to the connect screen and
   the grant disappears from [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Scripts

**Backend**

| Command | Does |
|---|---|
| `npm run dev` | Watch mode via `tsx` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Types only, no emit |

**Frontend**

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server with the `/api` proxy |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npm run typecheck` | Types only, no emit |

**Root**

| Command | Does |
|---|---|
| `npm run install:all` | Install both workspaces |
| `npm run dev` | Run backend and frontend together |
| `npm run build` | Build both |
| `npm run typecheck` | Typecheck both |

## Documentation

| Document | Contents |
|---|---|
| [docs/google-cloud-setup.md](docs/google-cloud-setup.md) | Cloud project, Gmail API, consent screen, scopes, OAuth client, test users, troubleshooting |
| [docs/api.md](docs/api.md) | Every endpoint, request and response shape, error codes, cURL examples |
| [docs/deployment.md](docs/deployment.md) | Deploying to Vercel — one project, serverless sessions, OAuth redirect URIs, troubleshooting |
| [docs/architecture.md](docs/architecture.md) | Flow diagrams, token refresh, threading, pagination, HTML sanitization, directory map |
| [ai/requirements.md](ai/requirements.md) | The original client requirements |
| [ai/implementation-status.md](ai/implementation-status.md) | Requirement → code mapping, and deliberate scope choices |

## Project layout

```
MailBridge/
├── ai/          Requirements and implementation status
├── api/         Vercel serverless entry (wraps the Express app)
├── docs/        Setup, API, architecture and deployment guides
├── backend/     Express + TypeScript API  (OAuth, Gmail, tokens)
└── frontend/    React + Vite + shadcn/ui
```

## Deploying

The app ships to **Vercel as a single project** — React build and API behind one
origin, which is what keeps the session cookie first-party and removes CORS from
the OAuth flow entirely. `vercel.json` and `api/index.mjs` are already in place.

Full walkthrough, including the environment variables and the production redirect
URI: **[docs/deployment.md](docs/deployment.md)**.

## Security notes

- **Locally**, access and refresh tokens live only on the backend, in
  `backend/data/accounts.json` (mode `0600`, gitignored). The browser receives a
  signed httpOnly cookie holding nothing but an opaque id.
- **On serverless** (Vercel), where there is no writable disk and no shared
  process, the session switches to an AES-256-GCM encrypted `httpOnly` cookie.
  The ciphertext is opaque to page scripts and a tampered value fails its auth
  tag. See [docs/deployment.md](docs/deployment.md) for how to move to a real
  store.
- The OAuth `state` parameter is generated per attempt and compared timing-safely
  in the callback.

# emailbridge
- Email HTML is sanitized with DOMPurify **and** rendered in an iframe whose
  sandbox omits `allow-scripts`.
- `helmet`, a per-IP rate limit, and Zod validation on every request body and
  query sit in front of the API.
- Nothing secret belongs in `frontend/.env.local` — Vite inlines those values
  into the bundle.

For a real deployment, replace the JSON token store with encrypted rows in a
database (a single module, `backend/src/services/tokenStore.ts`) and complete
Google's OAuth verification for the restricted Gmail scopes.

## Known scope boundaries

Deliberately not built, per the requirements' out-of-scope list: user accounts,
multi-tenancy, admin tooling, payments, production deployment config, and Gmail
features beyond the mail flows above — no drafts, no threaded conversation view,
no permanent delete.
