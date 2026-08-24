import DOMPurify from 'dompurify'

/**
 * Email HTML is attacker-controlled. Two defences are layered here:
 *
 *  1. DOMPurify strips scripts, event handlers and other active content.
 *  2. The caller renders the result inside a sandboxed iframe (see MessageBody),
 *     so even a bypass cannot touch this origin's DOM, cookies or storage.
 */
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'link'],
    FORBID_ATTR: ['srcset', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: false,
  })
}

export type EmailTheme = 'light' | 'dark'

const PALETTE: Record<EmailTheme, { text: string; link: string; quote: string; quoteBorder: string }> = {
  light: { text: '#18181b', link: '#2563eb', quote: '#52525b', quoteBorder: '#d4d4d8' },
  dark: { text: '#e4e4e7', link: '#7dd3fc', quote: '#a1a1aa', quoteBorder: '#3f3f46' },
}

/**
 * The iframe cannot see the app's `.dark` class, and `prefers-color-scheme`
 * follows the OS rather than the in-app theme picker. So the colours are baked
 * in from the theme the app has actually resolved — otherwise choosing Dark on
 * a light OS renders dark text on a dark background.
 */
function iframeStyles(theme: EmailTheme): string {
  const { text, link, quote, quoteBorder } = PALETTE[theme]
  return `
  :root { color-scheme: ${theme}; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.65;
    color: ${text};
    background: transparent;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  img, video { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  a { color: ${link}; }
  blockquote {
    margin: 0 0 0 0.25rem;
    padding-left: 0.85rem;
    border-left: 2px solid ${quoteBorder};
    color: ${quote};
  }
  pre { white-space: pre-wrap; }
`
}

/** Wraps sanitized email HTML in a self-contained document for the iframe. */
export function buildEmailDocument(html: string, theme: EmailTheme = 'light'): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" rel="noopener noreferrer" />
<style>${iframeStyles(theme)}</style></head>
<body>${html}</body></html>`
}

/** Plain-text bodies get escaped and line-wrapped rather than rendered raw. */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escaped}</pre>`
}
