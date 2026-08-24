# API reference

Base URL: `http://localhost:4000/api`
During development the React app calls `/api/...` and Vite proxies to the above,
so browser and API share an origin and the session cookie just works.

## Conventions

**Authentication.** Every `/api/gmail/*` route requires the `mb_account` cookie —
signed, `httpOnly`, `sameSite=lax`, set by the OAuth callback. It holds an opaque
account id, never a token. Browser clients must send credentials
(`withCredentials: true` in axios, `credentials: 'include'` in fetch).

**Errors.** Every failure returns the same envelope with an appropriate status:

```json
{ "error": { "code": "GMAIL_NOT_CONNECTED", "message": "No Gmail account is connected." } }
```

| Code | Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Body or query failed validation. `details` carries the Zod issues in development. |
| `GMAIL_NOT_CONNECTED` | 401 | No account cookie, or no stored account for it. |
| `GMAIL_AUTH_EXPIRED` | 401 | Google rejected the stored credentials. Reconnect. |
| `GMAIL_FORBIDDEN` | 403 | Missing scope or a Gmail policy refusal. |
| `NOT_FOUND` | 404 | Unknown route, message or attachment. |
| `GMAIL_RATE_LIMITED` | 429 | Gmail quota hit. |
| `RATE_LIMITED` | 429 | This server's own limiter: 120 requests/minute per IP. |
| `BAD_REQUEST` | 400 | Also returned when an attachment exceeds 25 MB or there are more than 5. |
| `GMAIL_API_ERROR` | 502 | Any other Gmail API failure. |
| `INTERNAL_ERROR` | 500 | Unhandled server error. |

**Rate limit.** 120 requests per minute per IP across `/api`, reported via
`RateLimit-*` headers.

---

## Health

### `GET /api/health`

```json
{ "status": "ok", "uptime": 42.31 }
```

---

## Authentication

### `GET /api/auth/google`

Starts the OAuth flow. Sets a short-lived signed `state` cookie and issues a
**302** to Google's consent screen. Navigate the browser here — do not fetch it.

### `GET /api/auth/google/callback`

Google's redirect target. Validates `state`, exchanges `code` for tokens, reads
the account's email, stores everything server-side, sets the `mb_account`
cookie, then redirects to `FRONTEND_URL`:

- success → `?connected=1`
- failure → `?error=<code>` where `<code>` is one of `access_denied`,
  `state_mismatch`, `missing_code`, `token_exchange_failed`,
  `profile_unavailable`, `oauth_failed`

Not called directly by the frontend.

### `GET /api/auth/status`

```json
{
  "connected": true,
  "account": {
    "email": "example@gmail.com",
    "name": "Example User",
    "picture": "https://lh3.googleusercontent.com/...",
    "scopes": ["openid", "https://www.googleapis.com/auth/gmail.modify", "..."],
    "connectedAt": "2026-08-23T09:14:02.114Z",
    "messagesTotal": 12843,
    "threadsTotal": 9021
  }
}
```

When nothing is connected: `{ "connected": false, "account": null }`. If stored
tokens exist but Gmail rejects them, the cookie is cleared and the response adds
`"reason": "GMAIL_AUTH_EXPIRED"`.

### `POST /api/auth/disconnect`

Revokes the refresh token at Google, deletes the stored record, clears the cookie.

```json
{ "connected": false, "account": null }
```

---

## Gmail

All routes below require a connected account.

### `GET /api/gmail/profile`

Gmail account information for the connected mailbox, read via `users.getProfile`.
Same payload as the `account` object in `/api/auth/status`, without the wrapper.

```json
{
  "email": "example@gmail.com",
  "name": "Example User",
  "picture": "https://lh3.googleusercontent.com/...",
  "scopes": ["openid", "https://www.googleapis.com/auth/gmail.modify", "..."],
  "connectedAt": "2026-08-23T09:14:02.114Z",
  "messagesTotal": 12843,
  "threadsTotal": 9021
}
```

### `GET /api/gmail/labels`

Every label the mailbox has, with counts, sorted by name. Counts come from a
`labels.get` per label (capped at 25 to keep the sidebar cheap), so a label
beyond that cap returns without `messagesTotal` / `messagesUnread`.

```json
{
  "labels": [
    { "id": "INBOX", "name": "INBOX", "type": "system", "messagesTotal": 201, "messagesUnread": 4 },
    { "id": "Label_11", "name": "Clients", "type": "user", "messagesTotal": 34, "messagesUnread": 3 }
  ]
}
```

### `GET /api/gmail/inbox`
### `GET /api/gmail/sent`

| Query | Type | Default | Notes |
|---|---|---|---|
| `pageToken` | string | – | Opaque cursor from a previous response's `nextPageToken`. |
| `maxResults` | 1–50 | `20` | Messages per page. |
| `q` | string | – | Gmail search syntax, e.g. `from:ana@example.com has:attachment`. |
| `labelId` | string | – | Lists this label instead of the default mailbox — `STARRED`, `IMPORTANT`, or a user label id. Inbox only. |

```json
{
  "messages": [
    {
      "id": "1932f0c9d8e7b6a5",
      "threadId": "1932f0c9d8e7b6a5",
      "from": { "name": "Ana Silva", "email": "ana@example.com" },
      "to": [{ "name": "Example User", "email": "example@gmail.com" }],
      "cc": [],
      "subject": "Quarterly report attached",
      "snippet": "Hi — the numbers you asked for…",
      "date": "2026-08-23T08:41:00.000Z",
      "unread": true,
      "starred": false,
      "hasAttachments": true,
      "labelIds": ["INBOX", "UNREAD"]
    }
  ],
  "nextPageToken": "09876543210987654321",
  "resultSizeEstimate": 201
}
```

`nextPageToken` is `null` on the last page. Gmail's cursors are forward-only, so
"previous page" is implemented client-side by replaying visited tokens.

### `GET /api/gmail/messages/:messageId`

Returns the full message and, as a side effect, removes the `UNREAD` label —
same behaviour as opening the mail in Gmail.

```json
{
  "id": "1932f0c9d8e7b6a5",
  "threadId": "1932f0c9d8e7b6a5",
  "from": { "name": "Ana Silva", "email": "ana@example.com" },
  "to": [{ "email": "example@gmail.com" }],
  "cc": [],
  "bcc": [],
  "replyTo": [],
  "subject": "Quarterly report attached",
  "snippet": "Hi — the numbers you asked for…",
  "date": "2026-08-23T08:41:00.000Z",
  "unread": false,
  "starred": false,
  "hasAttachments": true,
  "labelIds": ["INBOX"],
  "bodyHtml": "<div>…</div>",
  "bodyText": "…",
  "attachments": [
    { "attachmentId": "ANGjdJ_…", "filename": "q3.pdf", "mimeType": "application/pdf", "size": 284100 }
  ],
  "messageIdHeader": "<CAF…@mail.gmail.com>",
  "referencesHeader": null
}
```

`bodyHtml` is raw Gmail HTML. The frontend runs it through DOMPurify and renders
it in a script-free sandboxed iframe — do the same in any other client.

### `GET /api/gmail/messages/:messageId/attachments/:attachmentId`

Streams the attachment with its real `Content-Type` and a
`Content-Disposition: attachment` header.

### Message actions

| Route | Body | Effect |
|---|---|---|
| `POST /api/gmail/messages/:messageId/star` | `{ "starred": true }` | Adds or removes the `STARRED` label |
| `POST /api/gmail/messages/:messageId/read` | `{ "read": false }` | Adds or removes the `UNREAD` label |
| `POST /api/gmail/messages/:messageId/trash` | – | Moves to Trash (reversible for 30 days) |
| `POST /api/gmail/messages/:messageId/untrash` | – | Restores from Trash |

Star, read and untrash return the updated message summary. Trash returns
`{ "trashed": true, "messageId": "…" }`.

Nothing here deletes permanently — `messages.delete` is never called.

### `POST /api/gmail/send`

```json
{
  "to": "someone@example.com, another@example.com",
  "cc": "boss@example.com",
  "bcc": "",
  "subject": "Hello from MailBridge",
  "body": "Plain text body — always required, sent as the text/plain part.",
  "bodyHtml": "<p>Optional rich body, sent as the <b>text/html</b> part.</p>"
}
```

`to`, `cc` and `bcc` accept either a comma-separated string or an array of
strings. `to` must resolve to at least one valid address; `body` cannot be empty.

`bodyHtml` is optional. When present it becomes the HTML alternative; when
absent, HTML is generated from `body`. It is sanitized server-side — scripts,
event handlers, `javascript:` URLs and embedded frames are stripped before the
message leaves the server.

**Attachments.** Send the same route as `multipart/form-data` with one or more
`attachments` file fields instead of JSON. Up to **5 files, 25 MB each** (Gmail's
own ceiling). Files are held in memory only long enough to be encoded into the
MIME message — nothing is written to disk.

```bash
curl --cookie cookies.txt -X POST http://localhost:4000/api/gmail/send \
  -F 'to=you@example.com' \
  -F 'subject=Report attached' \
  -F 'body=See the attached file.' \
  -F 'attachments=@q3-report.pdf'
```

With attachments the message becomes `multipart/mixed` wrapping the
`multipart/alternative` body; without them it stays `multipart/alternative`.

**201 Created**

```json
{ "id": "1932f1a…", "threadId": "1932f1a…", "labelIds": ["SENT"], "sentFrom": "example@gmail.com" }
```

`sentFrom` is the address the recipient will see in the `From` line.

### `POST /api/gmail/reply/:messageId`

```json
{ "body": "Thanks — looking now.", "bodyHtml": "<p>Thanks — looking now.</p>", "replyAll": false, "cc": "", "bcc": "" }
```

Accepts `multipart/form-data` with `attachments` exactly like `/send`.

Recipient, subject (`Re: …`), `In-Reply-To`, `References` and Gmail's `threadId`
are all derived from the original, so the reply lands in the same conversation.
With `replyAll: true`, everyone on the original `To` and `Cc` is added to `Cc`,
minus the connected account itself. The original message is quoted below the
reply body. Returns the same **201** shape as `/send`.

### `POST /api/gmail/forward/:messageId`

```json
{ "to": "colleague@example.com", "cc": "", "bcc": "", "body": "FYI — see below.", "bodyHtml": "<p>FYI — see below.</p>" }
```

Accepts `multipart/form-data` with `attachments` exactly like `/send`.

Subject becomes `Fwd: …`, and a standard forwarded-message block with the
original headers and body is appended. `body` is optional. Returns the same
**201** shape as `/send`.

---

## cURL walkthrough

The cookie is httpOnly, so grab it with a browser session or a cookie jar.

```bash
# 1. Connect in a browser first, then export the cookie jar, or:
open http://localhost:4000/api/auth/google

# 2. Check status (cookie jar from the browser session)
curl -s --cookie cookies.txt http://localhost:4000/api/auth/status | jq

# 3. First inbox page
curl -s --cookie cookies.txt 'http://localhost:4000/api/gmail/inbox?maxResults=5' | jq '.messages[].subject'

# 4. Send a message
curl -s --cookie cookies.txt -X POST http://localhost:4000/api/gmail/send \
  -H 'content-type: application/json' \
  -d '{"to":"you@example.com","subject":"MailBridge test","body":"Sent via the Gmail API."}' | jq
```
