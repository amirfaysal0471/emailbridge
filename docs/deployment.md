# Deploying to Vercel

The whole app — React build and Express API — ships as **one Vercel project**.
That is a deliberate choice, and it is what makes authentication work.

## Why one project

Splitting the frontend and API across two domains breaks OAuth in three separate
ways, and every one of them is avoidable:

| Split hosting | One origin |
|---|---|
| Session cookie is cross-site, so it needs `SameSite=None; Secure` — and Safari plus most tracking-prevention modes drop it anyway | `SameSite=Lax` works everywhere |
| Every API call needs CORS with `credentials`, and a wildcard origin is forbidden | No CORS at all |
| Two domains to keep in sync in Google Cloud | One redirect URI |

With a single project the browser sees `https://your-app.vercel.app` for both the
page and `/api/*`, so the cookie is first-party and none of the above applies.

## What is already wired up

- **`vercel.json`** — builds both packages, serves `frontend/dist`, rewrites
  `/api/*` into the serverless function and everything else into the SPA
- **`api/index.mjs`** — the Express app exported as one Vercel function
- **Serverless-safe sessions** — Vercel's filesystem is read-only and no two
  requests share a process, so the JSON token store cannot work there. The app
  detects the platform and switches to an **AES-256-GCM encrypted session
  cookie**: the ciphertext is opaque to the browser, the cookie is `httpOnly`,
  and a tampered value fails the auth tag and reads as signed out. The bulky
  `id_token` is dropped so the cookie stays around 1.1 KB, well inside the 4 KB
  browser limit.

---

## 1. Push the repository

Vercel deploys from Git. From the project root:

```bash
git init && git add -A && git commit -m "MailBridge Gmail demo"
```

Create an empty repository on GitHub, then:

```bash
git remote add origin https://github.com/<you>/mailbridge.git && git push -u origin main
```

`.env` files are gitignored — confirm with `git status` before pushing that no
`.env` and no `backend/data/accounts.json` are staged.

## 2. Import the project into Vercel

At [vercel.com/new](https://vercel.com/new), import the repository. Leave every
build setting untouched — `vercel.json` already specifies them. Do **not** set a
Root Directory; the config expects the repository root.

Deploy once so Vercel assigns the domain. It will fail to authenticate until the
environment variables below are set — that is expected.

## 3. Set environment variables

Vercel project → **Settings → Environment Variables**. Add these for
**Production** (and Preview, if you intend to test there):

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | your client id |
| `GOOGLE_CLIENT_SECRET` | your client secret |
| `GOOGLE_REDIRECT_URI` | `https://<your-domain>/api/auth/google/callback` |
| `FRONTEND_URL` | `https://<your-domain>` |
| `SAME_ORIGIN` | `true` |
| `SESSION_SECRET` | a fresh 64-char hex string |
| `NODE_ENV` | `production` |

Generate a **new** session secret for production — never reuse the local one:

```bash
openssl rand -hex 32
```

`SESSION_BACKEND` can be left unset; `auto` detects Vercel and selects the
cookie backend on its own.

> Changing `SESSION_SECRET` later invalidates every existing session — the
> encrypted cookies can no longer be decrypted and users simply reconnect.

## 4. Add the production redirect URI in Google Cloud

**APIs & Services → Credentials → your OAuth client**

- **Authorized JavaScript origins:** add `https://<your-domain>`
- **Authorized redirect URIs:** add `https://<your-domain>/api/auth/google/callback`

Keep the localhost entries so local development keeps working — an OAuth client
accepts several of each.

The redirect URI must match `GOOGLE_REDIRECT_URI` **character for character**,
including `https` and the absence of a trailing slash. A mismatch produces
`Error 400: redirect_uri_mismatch`, which is the single most common deployment
failure.

## 5. Redeploy and connect

Trigger a redeploy so the new environment variables are picked up
(**Deployments → ⋯ → Redeploy**), open the domain, and click **Continue with
Google** using an account on your **Test users** list.

---

## Preview deployments

Every Vercel preview gets its own URL (`mailbridge-abc123-you.vercel.app`), and
Google will reject a redirect URI it has never seen. Two options:

1. **Test on production only** — simplest, and what a demo needs.
2. **Register a stable preview domain** — assign a fixed domain to the preview
   branch in Vercel, then add that one URL to Google Cloud and set the preview
   environment variables to match.

Do not try to register wildcard redirect URIs; Google does not accept them.

## Function limits worth knowing

- `maxDuration` is set to 30 s in `vercel.json`. Listing a page of mail makes one
  `messages.list` plus one `messages.get` per row, so a 50-message page is 51
  upstream calls — the default 10 s ceiling was not comfortable.
- The function is stateless. Anything the app needs between requests lives in the
  encrypted cookie; nothing is cached in memory across invocations.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Error 400: redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` differs from the value registered in Google Cloud. Compare them character by character. |
| `Error 403: access_denied` | The Google account is not on the **Test users** list. Add it under Google Auth Platform → Audience. |
| Connects, then immediately shows the connect screen again | `SESSION_SECRET` differs between the deployment that set the cookie and the one reading it, or `SAME_ORIGIN` is not `true`. |
| API returns 500 with "Invalid environment configuration" | A required variable is missing. The function logs list exactly which one. |
| Works locally, 401 on every API call in production | `SAME_ORIGIN` not set to `true`, so cookies are being issued as cross-site. |
| Cookie rejected by the browser | The deployment is not on HTTPS, or `SAME_ORIGIN=false` on a same-domain setup. |

## Moving off the cookie session

The encrypted cookie is the right call for a demo on serverless, but it does send
the tokens with every request. For production, swap in a real store — everything
goes through `backend/src/services/sessionStore.ts`, so it is one module:

1. Add a `kv` backend alongside `file` and `cookie` (Vercel KV, Upstash Redis or
   Postgres all fit the same four functions).
2. Keep the opaque-id cookie from the `file` backend and store the record under
   that id.
3. Encrypt the tokens at rest in whichever store you choose.
