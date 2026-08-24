import type { gmail_v1 } from 'googleapis'
import type { Attachment, EmailAddress, MessageDetail, MessageSummary } from '../types/index.js'

type Part = gmail_v1.Schema$MessagePart

export function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return ''
  const match = headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
  return match?.value ?? ''
}

/** Splits an address list on commas that are not inside quotes or angle brackets. */
function splitAddressList(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  let inAngle = false

  for (const char of value) {
    if (char === '"') inQuotes = !inQuotes
    else if (char === '<') inAngle = true
    else if (char === '>') inAngle = false

    if (char === ',' && !inQuotes && !inAngle) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

export function parseAddressList(value: string): EmailAddress[] {
  if (!value) return []
  return splitAddressList(value)
    .map(parseAddress)
    .filter((address): address is EmailAddress => address !== null)
}

export function parseAddress(value: string): EmailAddress | null {
  const raw = value.trim()
  if (!raw) return null

  const angled = raw.match(/^(.*)<([^>]+)>$/)
  if (angled) {
    const name = angled[1].trim().replace(/^"(.*)"$/, '$1').trim()
    return { name: name || undefined, email: angled[2].trim() }
  }
  return { email: raw }
}

export function decodeBody(data: string | null | undefined): string {
  if (!data) return ''
  return Buffer.from(data, 'base64url').toString('utf8')
}

interface WalkResult {
  html: string | null
  text: string | null
  attachments: Attachment[]
}

/** Depth-first walk of the MIME tree collecting the best body parts and attachments. */
export function walkParts(payload: Part | undefined): WalkResult {
  const result: WalkResult = { html: null, text: null, attachments: [] }
  if (!payload) return result

  const visit = (part: Part) => {
    const mimeType = part.mimeType ?? ''
    const filename = part.filename ?? ''

    if (filename && part.body?.attachmentId) {
      result.attachments.push({
        attachmentId: part.body.attachmentId,
        filename,
        mimeType: mimeType || 'application/octet-stream',
        size: part.body.size ?? 0,
      })
    } else if (mimeType === 'text/html' && result.html === null) {
      result.html = decodeBody(part.body?.data)
    } else if (mimeType === 'text/plain' && result.text === null) {
      result.text = decodeBody(part.body?.data)
    }

    part.parts?.forEach(visit)
  }

  visit(payload)
  return result
}

export function toMessageSummary(message: gmail_v1.Schema$Message): MessageSummary {
  const headers = message.payload?.headers ?? undefined
  const labelIds = message.labelIds ?? []
  const internalDate = message.internalDate ? Number(message.internalDate) : null

  return {
    id: message.id ?? '',
    threadId: message.threadId ?? '',
    from: parseAddress(getHeader(headers, 'From')),
    to: parseAddressList(getHeader(headers, 'To')),
    cc: parseAddressList(getHeader(headers, 'Cc')),
    subject: getHeader(headers, 'Subject') || '(no subject)',
    snippet: decodeHtmlEntities(message.snippet ?? ''),
    date: internalDate ? new Date(internalDate).toISOString() : null,
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    hasAttachments: hasAttachment(message.payload ?? undefined),
    labelIds,
  }
}

export function toMessageDetail(message: gmail_v1.Schema$Message): MessageDetail {
  const headers = message.payload?.headers ?? undefined
  const { html, text, attachments } = walkParts(message.payload ?? undefined)

  return {
    ...toMessageSummary(message),
    bcc: parseAddressList(getHeader(headers, 'Bcc')),
    replyTo: parseAddressList(getHeader(headers, 'Reply-To')),
    bodyHtml: html,
    bodyText: text,
    attachments,
    messageIdHeader: getHeader(headers, 'Message-ID') || null,
    referencesHeader: getHeader(headers, 'References') || null,
  }
}

function hasAttachment(payload: Part | undefined): boolean {
  if (!payload) return false
  if (payload.filename && payload.body?.attachmentId) return true
  return (payload.parts ?? []).some(hasAttachment)
}

/** Gmail snippets arrive with HTML entities already escaped. */
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
