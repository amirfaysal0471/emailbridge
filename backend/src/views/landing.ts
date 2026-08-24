import { env, isProduction } from '../config/env.js'

export interface EndpointGroup {
  title: string
  description: string
  routes: { method: string; path: string; summary: string }[]
}

/** Single source of truth for the API index — rendered as HTML and as JSON. */
export const ENDPOINTS: EndpointGroup[] = [
  {
    title: 'Authentication',
    description: 'Google OAuth 2.0 handshake and connection state.',
    routes: [
      { method: 'GET', path: '/api/auth/google', summary: 'Start the OAuth flow (redirects to Google)' },
      { method: 'GET', path: '/api/auth/google/callback', summary: 'OAuth redirect target' },
      { method: 'GET', path: '/api/auth/status', summary: 'Which Gmail account is connected' },
      { method: 'POST', path: '/api/auth/disconnect', summary: 'Revoke at Google and delete stored tokens' },
    ],
  },
  {
    title: 'Mailbox',
    description: 'Reading mail. Every route needs a connected account.',
    routes: [
      { method: 'GET', path: '/api/gmail/profile', summary: 'Account info via users.getProfile' },
      { method: 'GET', path: '/api/gmail/labels', summary: 'Labels with unread counts' },
      { method: 'GET', path: '/api/gmail/inbox', summary: 'Inbox page — pageToken, maxResults, q, labelId' },
      { method: 'GET', path: '/api/gmail/sent', summary: 'Sent page — same parameters' },
      { method: 'GET', path: '/api/gmail/messages/:messageId', summary: 'Full message with body and attachments' },
      {
        method: 'GET',
        path: '/api/gmail/messages/:messageId/attachments/:attachmentId',
        summary: 'Download one attachment',
      },
    ],
  },
  {
    title: 'Message actions',
    description: 'Label edits and trash. Nothing here deletes permanently.',
    routes: [
      { method: 'POST', path: '/api/gmail/messages/:messageId/star', summary: 'Add or remove STARRED' },
      { method: 'POST', path: '/api/gmail/messages/:messageId/read', summary: 'Add or remove UNREAD' },
      { method: 'POST', path: '/api/gmail/messages/:messageId/trash', summary: 'Move to Trash (reversible)' },
      { method: 'POST', path: '/api/gmail/messages/:messageId/untrash', summary: 'Restore from Trash' },
    ],
  },
  {
    title: 'Sending',
    description: 'JSON, or multipart/form-data with an `attachments` field.',
    routes: [
      { method: 'POST', path: '/api/gmail/send', summary: 'Compose and send' },
      { method: 'POST', path: '/api/gmail/reply/:messageId', summary: 'Reply on the original thread' },
      { method: 'POST', path: '/api/gmail/forward/:messageId', summary: 'Forward with the original quoted' },
    ],
  },
]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatUptime(seconds: number): string {
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

/**
 * Browser-facing status page for the API root.
 *
 * Opening a bare API host in a browser is a normal thing to do while wiring an
 * integration up — this answers "is it running, and what can it do?" instead of
 * returning a raw 404.
 */
export function renderLandingPage(uptimeSeconds: number): string {
  const groups = ENDPOINTS.map(
    (group) => `
      <section class="group">
        <h2>${escapeHtml(group.title)}</h2>
        <p class="muted">${escapeHtml(group.description)}</p>
        <ul>
          ${group.routes
            .map(
              (route) => `
            <li>
              <span class="method method--${route.method.toLowerCase()}">${route.method}</span>
              <code>${escapeHtml(route.path)}</code>
              <span class="muted summary">${escapeHtml(route.summary)}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </section>`,
  ).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MailBridge API</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --fg: #18181b; --muted: #71717a; --border: #e4e4e7;
    --card: #fafafa; --accent: #18181b; --accent-fg: #fafafa; --ok: #16a34a;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #09090b; --fg: #fafafa; --muted: #a1a1aa; --border: #27272a;
      --card: #131316; --accent: #fafafa; --accent-fg: #18181b; --ok: #4ade80;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 820px; margin: 0 auto; padding: 48px 20px 72px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .logo {
    width: 36px; height: 36px; border-radius: 10px; background: var(--accent); color: var(--accent-fg);
    display: grid; place-items: center; font-size: 17px;
  }
  h1 { font-size: 18px; margin: 0; letter-spacing: -0.01em; }
  .status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
  .facts {
    display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; margin-bottom: 32px;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .fact { background: var(--card); padding: 12px 14px; }
  .fact dt { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 3px; }
  .fact dd { margin: 0; font-size: 13px; word-break: break-all; }
  .cta {
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px;
    background: var(--card); margin-bottom: 36px;
  }
  .cta a { color: inherit; }
  .btn {
    display: inline-block; background: var(--accent); color: var(--accent-fg);
    padding: 7px 14px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 13px;
  }
  .group { margin-bottom: 28px; }
  .group h2 { font-size: 14px; margin: 0 0 2px; }
  .group > p { margin: 0 0 10px; font-size: 13px; }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  li {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px;
    padding: 9px 14px; background: var(--card); border-top: 1px solid var(--border);
  }
  li:first-child { border-top: 0; }
  .method {
    font: 600 10px/1 ui-monospace, SFMono-Regular, monospace; letter-spacing: .05em;
    padding: 4px 6px; border-radius: 5px; border: 1px solid var(--border); min-width: 42px; text-align: center;
  }
  .method--get { color: #2563eb; } .method--post { color: #ca8a04; }
  @media (prefers-color-scheme: dark) { .method--get { color: #7dd3fc; } .method--post { color: #fcd34d; } }
  code { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .summary { flex: 1 1 220px; font-size: 12px; }
  .muted { color: var(--muted); }
  footer { margin-top: 8px; font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="logo" aria-hidden="true">✉</div>
      <div>
        <h1>MailBridge API</h1>
        <span class="status"><span class="dot"></span> Running · uptime ${escapeHtml(formatUptime(uptimeSeconds))}</span>
      </div>
    </header>

    <div class="cta">
      <span>This is the API server. The app itself runs at</span>
      <a class="btn" href="${escapeHtml(env.FRONTEND_URL)}">${escapeHtml(env.FRONTEND_URL)}</a>
    </div>

    <dl class="facts">
      <div class="fact"><dt>Environment</dt><dd>${escapeHtml(env.NODE_ENV)}</dd></div>
      <div class="fact"><dt>Port</dt><dd>${env.PORT}</dd></div>
      <div class="fact"><dt>OAuth redirect URI</dt><dd>${escapeHtml(env.GOOGLE_REDIRECT_URI)}</dd></div>
      <div class="fact"><dt>Health check</dt><dd><a href="/api/health">/api/health</a></dd></div>
    </dl>

    ${groups}

    <footer>
      Request this URL with <code>Accept: application/json</code> for the machine-readable index.
      ${isProduction ? '' : 'Full documentation lives in <code>docs/api.md</code>.'}
    </footer>
  </div>
</body>
</html>`
}
