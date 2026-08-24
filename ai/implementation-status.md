# Implementation status

Maps every requirement in [`requirements.md`](./requirements.md) to where it lives in the code.

| § | Requirement | Status | Where |
|---|---|---|---|
| 2 | Connect Gmail button, OAuth 2.0 flow | Done | `frontend/src/pages/ConnectPage.tsx`, `backend/src/controllers/authController.ts` |
| 2 | Tokens handled backend-only | Done | `backend/src/services/tokenStore.ts` — browser holds an opaque signed cookie |
| 2 | Automatic access-token refresh | Done | `backend/src/lib/googleClient.ts` (`tokens` event → `updateTokens`) |
| 2 | Disconnect | Done | `ConnectedAccountCard.tsx` → `POST /api/auth/disconnect` (revokes at Google, deletes tokens) |
| 3 | Inbox list: sender, recipient, subject, date, snippet | Done | `GET /api/gmail/inbox` → `MessageList.tsx` |
| 3 | Open / view email with full body | Done | `GET /api/gmail/messages/:messageId` → `MessageView.tsx` |
| 3 | Refresh inbox | Done | Refresh button → React Query invalidation |
| 3 | Pagination | Done | `useMailbox.ts` — Gmail `pageToken` cursor stack |
| 3 | Reply / Forward from a received email | Done | `ComposeDialog.tsx`, `POST /api/gmail/{reply,forward}/:messageId` |
| 4 | Sent mailbox with the same detail view | Done | `GET /api/gmail/sent`, `MailboxPage.tsx` |
| 5 | Compose with To / Cc / Bcc / Subject / Body / Send | Done | `ComposeDialog.tsx` → `POST /api/gmail/send` |
| 5 | From address is the connected Gmail account | Done | `backend/src/utils/mime.ts` builds the RFC 5322 `From`; Gmail sends it as the account |
| 5 | No app-owned SMTP anywhere | Done | Only `gmail.users.messages.send` is used; no mail transport dependency exists |
| 6 | Reply stays on the original thread | Done | `In-Reply-To`, `References` and Gmail `threadId` are all set |
| 7 | Forward with quoted original | Done | `gmailService.ts` → `forwardedBlock()` |
| 8 | Express backend, error handling | Done | `backend/src/app.ts`, `middleware/errorHandler.ts` |
| 9 | All required screens + loading / error / success states | Done | `frontend/src/pages`, `components/common`, `sonner` toasts |
| 10 | Google Cloud setup documentation | Done | [`docs/google-cloud-setup.md`](../docs/google-cloud-setup.md) |
| 11 | `.env.example` for both apps | Done | `backend/.env.example`, `frontend/.env.example` |
| 13 | API + architecture documentation | Done | [`docs/api.md`](../docs/api.md), [`docs/architecture.md`](../docs/architecture.md) |

## Beyond the spec

Added on top of the requirements because they make the demo land better with a
client, and each one exercises more of the Gmail API:

| Feature | Gmail API surface |
|---|---|
| Rich-text compose (Tiptap) with HTML + plain-text alternatives | `messages.send` with `multipart/alternative` |
| Attachments on send / reply / forward, 5 files up to 25 MB | `multipart/mixed` MIME assembly |
| Label sidebar with live unread counts, click to filter | `labels.list`, `labels.get`, `messages.list` by label |
| Star / unstar, mark read / unread | `messages.modify` label edits |
| Move to Trash with Undo | `messages.trash` / `messages.untrash` (never `messages.delete`) |
| Gmail search over any mailbox | `messages.list` `q` parameter |
| Dark mode across the app and the email body renderer | – |
| Keyboard shortcuts (`c`, `g i`, `g s`, `/`, `r`, `?`) | – |

## Deliberate demo-scope choices

- **Four OAuth scopes, not five.** `gmail.modify` is accepted by
  `users.messages.send`, so a separate `gmail.send` would add no capability.
  Fewer restricted scopes also means less to justify at verification time.

- **Token storage is a JSON file** (`backend/data/accounts.json`, mode `0600`, gitignored).
  Every read and write goes through `tokenStore.ts`, so moving to Postgres or an
  encrypted column is a change to one module. Requirement §11 lists database config
  as optional ("if required") and the demo does not need one.
- **No permanent delete.** Trash is reversible and `messages.delete` is never
  called, so a demo can never destroy a client's mail.
- **Search** was added on top of the spec because Gmail's `q` parameter came free
  with the list endpoint. It is not a requirement.
- **No production deployment config** — explicitly out of scope per §14.
