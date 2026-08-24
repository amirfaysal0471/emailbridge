import type { EmailAddress } from '../types/index.js'

export interface OutgoingAttachment {
  filename: string
  mimeType: string
  content: Buffer
}

export interface MimeMessageInput {
  from: EmailAddress
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  /** Plain-text body. Always sent as the text/plain alternative. */
  body: string
  /** Optional rich-text body. When absent, HTML is generated from `body`. */
  bodyHtml?: string
  attachments?: OutgoingAttachment[]
  inReplyTo?: string | null
  references?: string | null
}

const CRLF = '\r\n'

/** RFC 2047 encoding so non-ASCII subjects and display names survive transport. */
function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

export function formatAddress({ name, email }: EmailAddress): string {
  if (!name) return email
  return `${encodeHeaderValue(name)} <${email}>`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

/**
 * Strips active content from rich-text bodies.
 *
 * The HTML comes from this app's own editor, but it still arrives over the
 * network, so it is treated as untrusted: nothing that could execute is allowed
 * to leave the server inside an outgoing message.
 */
export function sanitizeOutgoingHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|link|base|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|base|form)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
}

/** The HTML part: the editor's markup when present, otherwise built from the text. */
function htmlPart(input: MimeMessageInput): string {
  if (input.bodyHtml?.trim()) return sanitizeOutgoingHtml(input.bodyHtml)
  return `<div>${textToHtml(input.body)}</div>`
}

let boundaryCounter = 0
function boundary(prefix: string): string {
  boundaryCounter += 1
  return `----=_MailBridge_${prefix}_${boundaryCounter}_${Math.random().toString(36).slice(2)}`
}

/**
 * Builds an RFC 5322 message.
 *
 * Without attachments the body is a simple `multipart/alternative` (plain + HTML).
 * With attachments it nests that inside a `multipart/mixed`:
 *
 *   multipart/mixed
 *   ├── multipart/alternative
 *   │   ├── text/plain
 *   │   └── text/html
 *   └── <each attachment, base64>
 *
 * Gmail's users.messages.send takes the whole raw message, which is why the
 * From header — and therefore what the recipient sees — is the connected
 * account rather than any server-side SMTP identity.
 */
export function buildMimeMessage(input: MimeMessageInput): string {
  const attachments = input.attachments ?? []
  const alt = boundary('alt')

  const headers: string[] = [`From: ${formatAddress(input.from)}`, `To: ${input.to.join(', ')}`]

  if (input.cc?.length) headers.push(`Cc: ${input.cc.join(', ')}`)
  if (input.bcc?.length) headers.push(`Bcc: ${input.bcc.join(', ')}`)

  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`)

  // Threading headers: without these a reply shows up as a new conversation.
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`)
  if (input.references) headers.push(`References: ${input.references}`)

  headers.push('MIME-Version: 1.0')

  const alternativePart = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    chunk(Buffer.from(input.body, 'utf8').toString('base64')),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    chunk(Buffer.from(htmlPart(input), 'utf8').toString('base64')),
    `--${alt}--`,
  ]

  if (!attachments.length) {
    headers.push(`Content-Type: multipart/alternative; boundary="${alt}"`)
    return [...headers, '', ...alternativePart, ''].join(CRLF)
  }

  const mixed = boundary('mixed')
  headers.push(`Content-Type: multipart/mixed; boundary="${mixed}"`)

  const parts = [
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    ...alternativePart,
  ]

  for (const attachment of attachments) {
    parts.push(
      `--${mixed}`,
      `Content-Type: ${attachment.mimeType}; name="${encodeHeaderValue(attachment.filename)}"`,
      `Content-Disposition: attachment; filename="${encodeHeaderValue(attachment.filename)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      chunk(attachment.content.toString('base64')),
    )
  }

  parts.push(`--${mixed}--`)

  return [...headers, '', ...parts, ''].join(CRLF)
}

/** Gmail's raw field is base64url with no padding. */
export function toRawMessage(mime: string): string {
  return Buffer.from(mime, 'utf8').toString('base64url')
}

/** Base64 bodies must be wrapped at 76 characters per RFC 2045. */
function chunk(value: string): string {
  return (value.match(/.{1,76}/g) ?? []).join(CRLF)
}
