# Architecture and flows

## Shape of the system

```
┌──────────────────────────┐         ┌───────────────────────────┐        ┌──────────────┐
│  React (Vite) :5173      │  /api   │  Express (Node) :4000     │ HTTPS  │  Google      │
│                          │ ──────▶ │                           │ ─────▶ │              │
│  • Connect screen        │ cookie  │  • OAuth 2.0 handshake    │        │  • OAuth 2.0 │
│  • Inbox / Sent          │  only   │  • Token store + refresh  │        │  • Gmail API │
│  • Reader, Compose       │ ◀────── │  • Gmail read / send      │ ◀───── │              │
└──────────────────────────┘  JSON   └───────────────────────────┘        └──────────────┘
                                                  │
                                                  ▼
                                      backend/data/accounts.json
                                      (tokens, mode 0600, gitignored)
```

The dividing line that matters: **access and refresh tokens never leave the
backend**. The browser holds one thing — a signed, httpOnly cookie containing an
opaque account id. Even a successful XSS in the React app cannot read it, and it
is worthless outside this server.

## Connect flow

```
User clicks "Connect Gmail"
   │
   ├─▶ browser navigates to  GET /api/auth/google
   │        backend generates a random `state`, stores it in a signed
   │        10-minute cookie, and 302s to Google with:
   │          access_type=offline   → issue a refresh token
   │          prompt=consent        → issue it even on a repeat authorization
   │
   ├─▶ Google shows the consent screen, user approves
   │
   ├─▶ Google redirects to  GET /api/auth/google/callback?code=…&state=…
   │        1. compare `state` against the cookie (timing-safe) — CSRF defence
   │        2. exchange `code` for { access_token, refresh_token, expiry_date }
   │        3. read the account's email via the userinfo endpoint
   │        4. upsert into the token store, keyed by an opaque uuid
   │        5. set the signed httpOnly `mb_account` cookie
   │        6. 302 to FRONTEND_URL?connected=1
   │
   └─▶ React sees ?connected=1, toasts, refetches /api/auth/status, renders the inbox
```

## Token refresh

Nothing polls and nothing schedules. `google-auth-library` compares
`expiry_date` before each request and refreshes transparently when the access
token is stale. The client emits a `tokens` event with the new credentials, and
`lib/googleClient.ts` writes them back through `tokenStore.updateTokens`:

```
gmail.users.messages.list()
   └─▶ access token expired?
          ├─ no  → send the request
          └─ yes → POST /token with the refresh token
                     └─▶ 'tokens' event → updateTokens() → accounts.json
                            └─▶ send the original request
```

Because the refreshed token is persisted, a server restart does not force the
user to reconnect. Google sometimes omits `refresh_token` on a repeat consent;
`saveAccount` keeps the one already on file rather than overwriting it with null.

## Send / reply / forward

All three converge on the same two steps, which is why the From address is
never in question:

```
build an RFC 5322 message  →  base64url  →  gmail.users.messages.send({ raw })
   (utils/mime.ts)                            (as the connected account)
```

The message body is always sent as two alternatives — the compose editor emits
HTML and a plain-text mirror of the same content, so recipients on any client
see something sensible. Attachments wrap that in a `multipart/mixed`:

```
multipart/mixed
├── multipart/alternative
│   ├── text/plain      ← editor's plain-text output
│   └── text/html       ← editor's HTML, sanitized server-side
└── application/pdf     ← each attachment, base64
```

Rich HTML arriving from the browser is stripped of scripts, event handlers,
`javascript:` URLs and frames before it is encoded — the app must never be a
vehicle for sending active content.

Gmail sends the raw message *as the authorized mailbox*. There is no SMTP
transport, no nodemailer, no service account, and no app-owned address anywhere
in the dependency tree — so the recipient's `From` line is always the connected
Gmail account.

Reply adds the threading headers that make Gmail treat it as a continuation
rather than a new conversation:

| Header | Source |
|---|---|
| `In-Reply-To` | original `Message-ID` |
| `References` | original `References` + original `Message-ID` |
| `threadId` (API field) | original `threadId` |

Forward keeps `References` for context, prefixes the subject with `Fwd:`, and
appends a standard forwarded-message block.

## Search lives in the URL

The app-bar search writes `?q=…` rather than holding local state. `useMailbox`
reads it back, so one search box drives whichever mailbox or label is open, the
browser's back button steps through past queries, and a filtered view is a
shareable link. Gmail's own operators pass straight through to the API —
`is:unread`, `from:someone@example.com`, `has:attachment`.

## Pagination

Gmail returns opaque, forward-only `pageToken` cursors — there is no "page 3"
and no way to go back. `useMailbox` keeps a stack of visited cursors:

```
cursors: [null, "tokenA", "tokenB"]     pageIndex: 2
          page1     page2     page3
```

Next pushes the token Gmail just returned; Prev decrements the index and reuses
a cursor already in the stack. React Query's `keepPreviousData` means paging does
not flash an empty list. Changing mailbox or search resets the stack.

Listing costs two round trips per page by design: `messages.list` returns ids
only, so each row needs a `messages.get` with `format=metadata` (headers and
snippet, no body). Bodies are fetched only when a message is opened.

## Rendering untrusted email HTML

Email bodies are attacker-controlled, so they get two independent defences:

1. **DOMPurify** strips scripts, event handlers, `<iframe>`, `<object>`,
   `<form>`, `<base>` and friends.
2. The result renders inside an **iframe whose sandbox omits `allow-scripts`**,
   so no JavaScript can execute in that document at all.

Because scripts are dead in the frame, `allow-same-origin` is safe to grant, and
it buys the ability to measure `scrollHeight` from the parent so the frame can
size itself to the content. Links carry `target="_blank"` via a `<base>` tag and
`referrerPolicy="no-referrer"`.

## Error handling

Failures travel one path. `gmailService.ts` wraps every Google call and
translates status codes into `ApiError`s; controllers throw freely (Express 5
forwards rejected promises); `middleware/errorHandler.ts` renders the single JSON
envelope. On the client, `toErrorMessage()` unwraps that envelope for toasts and
inline error blocks, and React Query is configured never to retry a 401/403 —
those need a reconnect, not another attempt.

## Directory map

```
MailBridge/
├── ai/                          Client requirements + implementation status
├── docs/                        Setup, API and architecture documentation
├── backend/
│   └── src/
│       ├── config/env.ts        Zod-validated environment; refuses to boot if invalid
│       ├── lib/googleClient.ts  OAuth client factory, scopes, auto-refresh wiring
│       ├── services/            tokenStore (persistence) · gmailService (all Gmail calls)
│       ├── controllers/         authController · gmailController
│       ├── routes/              authRoutes · gmailRoutes
│       ├── middleware/          requireAccount · validate · upload · errorHandler
│       ├── utils/               ApiError · cookies · mime · gmailParse · schemas
│       ├── app.ts               Express assembly (helmet, cors, rate limit, routes)
│       └── server.ts            Listener + graceful shutdown
└── frontend/
    └── src/
        ├── api/                 axios instance + typed endpoint wrappers
        ├── components/ui/       shadcn/ui primitives
        ├── components/common/   StateBlock · SenderAvatar · FieldRow · skeletons
        ├── components/mail/     MessageList · MessageView · MessageBody · ComposeDialog · RichTextEditor
        ├── components/layout/   AppShell · MailboxNav · HeaderSearch · ConnectedAccountCard
        │                         ThemeToggle · ShortcutsDialog
        ├── hooks/               useAuth · useMailbox · useMessage · useLabels · useMessageActions
        │                         useKeyboardShortcuts · useSidebar · useMediaQuery
        ├── lib/                 format · sanitize · queryKeys · utils
        ├── pages/               ConnectPage · MailboxPage
        └── types/               Shared response types (mirrors the backend)
```

Layering rule, both sides: components and controllers never call Google or axios
directly. The frontend goes through `api/`, the backend through `services/`.
That keeps the Gmail-specific surface in two files and makes the token store
swappable without touching a single route.
