# Google Cloud setup

Everything needed to get an OAuth client that can read and send Gmail for the
accounts you nominate. Takes about ten minutes. You only need a normal Google
account — no billing, no domain, no verification.

---

## 1. Create a project

1. Open [console.cloud.google.com](https://console.cloud.google.com/).
2. Click the project picker in the top bar → **New project**.
3. Name it (e.g. `mailbridge-demo`) → **Create**.
4. Make sure the picker now shows your new project before continuing — every
   step below applies to the *selected* project.

## 2. Enable the Gmail API

1. Go to **APIs & Services → Library**.
2. Search for **Gmail API** → open it → **Enable**.

Nothing else needs enabling. The People/userinfo endpoints used to read the
connected address come with OAuth itself.

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**

| Field | Value |
|---|---|
| User type | **External** (unless everyone testing is inside one Workspace org) |
| App name | `MailBridge Demo` |
| User support email | your address |
| Developer contact | your address |

Save and continue.

### Scopes

Click **Add or remove scopes** and add these four. `gmail.modify` is marked
*restricted* — that is expected and does not block testing.

| Scope | Why it is needed |
|---|---|
| `openid` | Identifies the account that just authorized |
| `.../auth/userinfo.email` | Reads the connected Gmail address |
| `.../auth/userinfo.profile` | Reads display name and avatar |
| `.../auth/gmail.modify` | Lists Inbox and Sent, reads bodies, marks messages read, **and sends, replies and forwards** |

Full scope strings are prefixed with `https://www.googleapis.com`, e.g.
`https://www.googleapis.com/auth/gmail.modify`.

> **Why no `gmail.send`?** `users.messages.send` accepts any one of
> `mail.google.com`, `gmail.modify`, `gmail.compose` or `gmail.send`. Since
> `gmail.modify` is already needed for reading, adding `gmail.send` would grant
> nothing extra — so the app requests four scopes instead of five.
>
> `gmail.modify` also covers everything `gmail.readonly` does, plus the label
> change that marks a message read when you open it. It cannot permanently delete
> anything. If you would rather the demo never write to the mailbox at all, you
> would need `gmail.readonly` **plus** `gmail.send` in
> `backend/src/lib/googleClient.ts` — opening a message then leaves it unread.

### Test users

While the consent screen is **unverified** (correct for a demo), only accounts
listed here can complete the flow.

1. Go to the **Test users** section (or **Audience** in the newer console).
2. **Add users** → enter every Gmail address that will be demoed, including your own.
3. Save.

Any other account will see *"MailBridge Demo has not completed the Google
verification process"* and be blocked. That is expected — production
verification is the client's team's job, per requirement §14.

## 4. Create the OAuth client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID**

| Field | Value |
|---|---|
| Application type | **Web application** |
| Name | `MailBridge local` |
| Authorized JavaScript origins | `http://localhost:5173` |
| Authorized redirect URIs | `http://localhost:4000/api/auth/google/callback` |

Click **Create**. Copy the **Client ID** and **Client secret** — the secret is
shown once, though you can always reset it later.

> ⚠️ The redirect URI must match `GOOGLE_REDIRECT_URI` in `backend/.env`
> **character for character** — scheme, port, path, no trailing slash. A mismatch
> produces `Error 400: redirect_uri_mismatch`, the single most common setup failure.

## 5. Fill in the environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env`:

```ini
GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
SESSION_SECRET=<paste the output of: openssl rand -hex 32>
FRONTEND_URL=http://localhost:5173
PORT=4000
```

`frontend/.env.local` needs nothing changed for local development —
`VITE_API_BASE_URL=/api` uses the Vite dev proxy.

The backend validates all of this at startup and refuses to boot with a clear
message if something is missing.

## 6. Verify

Start both apps (`npm run dev` in each), open <http://localhost:5173>, and click
**Connect Gmail**. You should land on Google's account chooser, see the five
scopes listed, and come back to a populated inbox.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Error 400: redirect_uri_mismatch` | The URI in Credentials differs from `GOOGLE_REDIRECT_URI`. Compare them character by character, including the port. |
| `Error 403: access_denied` | The Google account is not in **Test users**, or the consent screen is unpublished for a different user type. Add the address and retry. |
| Consent screen never asks for Gmail scopes | The scopes were not saved on the consent screen. Re-add them, then reconnect — Google caches prior grants. |
| Connected, but every mail call returns 403 | Gmail API is not enabled on the *selected* project. Enable it and reconnect. |
| No refresh token after reconnecting | Handled: the app always sends `prompt=consent`, and `tokenStore` keeps a previously issued refresh token if Google omits one. |
| Want a clean slate | Revoke the app at [myaccount.google.com/permissions](https://myaccount.google.com/permissions), then delete `backend/data/accounts.json`. |

## Moving to production (client's team)

Out of scope for this demo, but for reference: restricted Gmail scopes require
Google's OAuth verification, which means a published consent screen, a verified
domain, a homepage and privacy policy, a demo video, and — because the scopes are
restricted — a third-party security assessment (CASA). Budget weeks, not days.
