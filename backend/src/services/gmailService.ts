import type { gmail_v1 } from 'googleapis'
import { google } from 'googleapis'
import { getAuthorizedClient, getGmailClient } from '../lib/googleClient.js'
import { ApiError } from '../utils/ApiError.js'
import { buildMimeMessage, escapeHtml, formatAddress, sanitizeOutgoingHtml, toRawMessage } from '../utils/mime.js'
import type { OutgoingAttachment } from '../utils/mime.js'
import { toMessageDetail, toMessageSummary } from '../utils/gmailParse.js'
import type {
  AccountProfile,
  ConnectedAccount,
  EmailAddress,
  GmailLabel,
  MessageDetail,
  MessageListPage,
  MessageSummary,
} from '../types/index.js'

/** Headers we need for a list row — asking for fewer keeps list responses small. */
const SUMMARY_HEADERS = ['From', 'To', 'Cc', 'Subject', 'Date']

export type Mailbox = 'INBOX' | 'SENT'

export interface ListOptions {
  mailbox: Mailbox
  /** Overrides `mailbox` — lets the same listing serve STARRED, IMPORTANT or a user label. */
  labelId?: string
  pageToken?: string
  maxResults?: number
  query?: string
}

export interface ComposeInput {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  bodyHtml?: string
  attachments?: OutgoingAttachment[]
}

export interface ReplyInput {
  body: string
  bodyHtml?: string
  cc?: string[]
  bcc?: string[]
  replyAll?: boolean
  attachments?: OutgoingAttachment[]
}

export interface ForwardInput {
  to: string[]
  cc?: string[]
  bcc?: string[]
  body?: string
  bodyHtml?: string
  attachments?: OutgoingAttachment[]
}

export async function getProfile(account: ConnectedAccount): Promise<AccountProfile> {
  const gmail = getGmailClient(account)
  const { data } = await withGmailErrors(() => gmail.users.getProfile({ userId: 'me' }))

  return {
    email: data.emailAddress ?? account.email,
    name: account.name,
    picture: account.picture,
    scopes: account.scopes,
    connectedAt: account.connectedAt,
    messagesTotal: data.messagesTotal ?? undefined,
    threadsTotal: data.threadsTotal ?? undefined,
  }
}

/** Reads the OpenID profile straight after the OAuth exchange. */
export async function fetchUserInfo(account: Pick<ConnectedAccount, 'id' | 'tokens' | 'email'>) {
  const oauth2 = google.oauth2({
    version: 'v2',
    auth: getAuthorizedClient(account as ConnectedAccount),
  })
  const { data } = await withGmailErrors(() => oauth2.userinfo.get())
  return data
}

export async function listMessages(
  account: ConnectedAccount,
  { mailbox, labelId, pageToken, maxResults = 20, query }: ListOptions,
): Promise<MessageListPage> {
  const gmail = getGmailClient(account)

  const { data } = await withGmailErrors(() =>
    gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId || mailbox],
      maxResults,
      pageToken,
      q: query,
    }),
  )

  const ids = (data.messages ?? []).map((message) => message.id).filter((id): id is string => Boolean(id))

  // Gmail's list endpoint returns ids only, so each row needs a metadata fetch.
  const messages = await Promise.all(
    ids.map(async (id) => {
      const { data: message } = await withGmailErrors(() =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: SUMMARY_HEADERS,
        }),
      )
      return toMessageSummary(message)
    }),
  )

  return {
    messages,
    nextPageToken: data.nextPageToken ?? null,
    resultSizeEstimate: data.resultSizeEstimate ?? messages.length,
  }
}

export async function getMessage(account: ConnectedAccount, id: string): Promise<MessageDetail> {
  const gmail = getGmailClient(account)
  const { data } = await withGmailErrors(() => gmail.users.messages.get({ userId: 'me', id, format: 'full' }))
  return toMessageDetail(data)
}

export async function markAsRead(account: ConnectedAccount, id: string): Promise<void> {
  await setRead(account, id, true)
}

/** Toggles the UNREAD label. `read: false` puts the message back in bold. */
export async function setRead(account: ConnectedAccount, id: string, read: boolean): Promise<MessageSummary> {
  return modifyLabels(account, id, read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] })
}

/** Toggles the STARRED label. */
export async function setStarred(account: ConnectedAccount, id: string, starred: boolean): Promise<MessageSummary> {
  return modifyLabels(account, id, starred ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] })
}

async function modifyLabels(
  account: ConnectedAccount,
  id: string,
  requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<MessageSummary> {
  const gmail = getGmailClient(account)
  await withGmailErrors(() => gmail.users.messages.modify({ userId: 'me', id, requestBody }))
  // modify() returns the message without headers, so re-read the summary for the UI.
  return getMessageSummary(account, id)
}

/**
 * Moves a message to Trash. This is reversible — Gmail keeps trashed mail for
 * 30 days and `untrashMessage` puts it straight back. Nothing here deletes
 * permanently; that would need `messages.delete`, which the app never calls.
 */
export async function trashMessage(account: ConnectedAccount, id: string): Promise<void> {
  const gmail = getGmailClient(account)
  await withGmailErrors(() => gmail.users.messages.trash({ userId: 'me', id }))
}

export async function untrashMessage(account: ConnectedAccount, id: string): Promise<MessageSummary> {
  const gmail = getGmailClient(account)
  await withGmailErrors(() => gmail.users.messages.untrash({ userId: 'me', id }))
  return getMessageSummary(account, id)
}

async function getMessageSummary(account: ConnectedAccount, id: string): Promise<MessageSummary> {
  const gmail = getGmailClient(account)
  const { data } = await withGmailErrors(() =>
    gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: SUMMARY_HEADERS }),
  )
  return toMessageSummary(data)
}

/** How many labels get a follow-up count lookup. Each one is a separate API call. */
const LABEL_COUNT_LIMIT = 25

/**
 * Lists the mailbox's labels with unread counts.
 *
 * `labels.list` returns names and ids but no counts, so each label needs a
 * `labels.get`. Those run in parallel and are capped, since a heavily-labelled
 * account would otherwise fire off a hundred requests to draw a sidebar.
 */
export async function listLabels(account: ConnectedAccount): Promise<GmailLabel[]> {
  const gmail = getGmailClient(account)
  const { data } = await withGmailErrors(() => gmail.users.labels.list({ userId: 'me' }))

  const labels = (data.labels ?? []).filter((label) => label.id && label.name)

  // Hide Gmail's internal category/system labels the demo has no screen for.
  const visible = labels.filter(
    (label) => label.type === 'user' || ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'TRASH'].includes(label.id ?? ''),
  )

  const withCounts = await Promise.all(
    visible.slice(0, LABEL_COUNT_LIMIT).map(async (label) => {
      try {
        const { data: detail } = await withGmailErrors(() =>
          gmail.users.labels.get({ userId: 'me', id: label.id as string }),
        )
        return toLabel(label, detail.messagesTotal, detail.messagesUnread)
      } catch {
        // A count is decoration — never fail the whole sidebar over one label.
        return toLabel(label)
      }
    }),
  )

  const remainder = visible.slice(LABEL_COUNT_LIMIT).map((label) => toLabel(label))

  return [...withCounts, ...remainder].sort((a, b) => a.name.localeCompare(b.name))
}

function toLabel(
  label: { id?: string | null; name?: string | null; type?: string | null },
  messagesTotal?: number | null,
  messagesUnread?: number | null,
): GmailLabel {
  return {
    id: label.id as string,
    name: label.name as string,
    type: label.type === 'user' ? 'user' : 'system',
    messagesTotal: messagesTotal ?? undefined,
    messagesUnread: messagesUnread ?? undefined,
  }
}

export async function getAttachment(account: ConnectedAccount, messageId: string, attachmentId: string) {
  const gmail = getGmailClient(account)
  const { data } = await withGmailErrors(() =>
    gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId }),
  )
  return Buffer.from(data.data ?? '', 'base64url')
}

export async function sendMessage(account: ConnectedAccount, input: ComposeInput) {
  const mime = buildMimeMessage({
    from: senderIdentity(account),
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    body: input.body,
    bodyHtml: input.bodyHtml,
    attachments: input.attachments,
  })
  return dispatch(account, mime)
}

export async function replyToMessage(account: ConnectedAccount, messageId: string, input: ReplyInput) {
  const original = await getMessage(account, messageId)

  const recipients = original.replyTo.length ? original.replyTo : original.from ? [original.from] : []
  if (!recipients.length) {
    throw ApiError.badRequest('The original message has no address to reply to.')
  }

  // Reply-all keeps everyone on the thread except the connected account itself.
  const extraCc = input.replyAll
    ? [...original.to, ...original.cc]
        .map((address) => address.email)
        .filter((email) => email.toLowerCase() !== account.email.toLowerCase())
    : []

  const mime = buildMimeMessage({
    from: senderIdentity(account),
    to: recipients.map(formatAddress),
    cc: unique([...(input.cc ?? []), ...extraCc]),
    bcc: input.bcc,
    subject: withPrefix(original.subject, 'Re:'),
    body: `${input.body}\n\n${quoteOriginal(original)}`,
    bodyHtml: input.bodyHtml ? `${input.bodyHtml}${quoteOriginalHtml(original)}` : undefined,
    attachments: input.attachments,
    inReplyTo: original.messageIdHeader,
    references: [original.referencesHeader, original.messageIdHeader].filter(Boolean).join(' ') || null,
  })

  return dispatch(account, mime, original.threadId)
}

export async function forwardMessage(account: ConnectedAccount, messageId: string, input: ForwardInput) {
  const original = await getMessage(account, messageId)

  const mime = buildMimeMessage({
    from: senderIdentity(account),
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: withPrefix(original.subject, 'Fwd:'),
    body: `${input.body ? `${input.body}\n\n` : ''}${forwardedBlock(original)}`,
    bodyHtml: input.bodyHtml ? `${input.bodyHtml}${forwardedBlockHtml(original)}` : undefined,
    attachments: input.attachments,
    references: [original.referencesHeader, original.messageIdHeader].filter(Boolean).join(' ') || null,
  })

  return dispatch(account, mime)
}

async function dispatch(account: ConnectedAccount, mime: string, threadId?: string) {
  const gmail = getGmailClient(account)
  const { data } = await withGmailErrors(() =>
    gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: toRawMessage(mime), ...(threadId ? { threadId } : {}) },
    }),
  )
  return { id: data.id ?? '', threadId: data.threadId ?? '', labelIds: data.labelIds ?? [] }
}

function senderIdentity(account: ConnectedAccount): EmailAddress {
  return { name: account.name, email: account.email }
}

function withPrefix(subject: string, prefix: string): string {
  const clean = subject.trim()
  return clean.toLowerCase().startsWith(prefix.toLowerCase()) ? clean : `${prefix} ${clean}`
}

function quoteOriginal(message: MessageDetail): string {
  const when = message.date ? new Date(message.date).toUTCString() : 'an earlier date'
  const who = message.from ? formatAddress(message.from) : 'unknown sender'
  const body = plainBody(message)
  return [`On ${when}, ${who} wrote:`, ...body.split('\n').map((line) => `> ${line}`)].join('\n')
}

function forwardedBlock(message: MessageDetail): string {
  return [
    '---------- Forwarded message ----------',
    `From: ${message.from ? formatAddress(message.from) : 'unknown'}`,
    `Date: ${message.date ? new Date(message.date).toUTCString() : 'unknown'}`,
    `Subject: ${message.subject}`,
    `To: ${message.to.map(formatAddress).join(', ')}`,
    message.cc.length ? `Cc: ${message.cc.map(formatAddress).join(', ')}` : '',
    '',
    plainBody(message),
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/** HTML twin of quoteOriginal, so rich replies keep the quoted thread styled. */
function quoteOriginalHtml(message: MessageDetail): string {
  const when = message.date ? new Date(message.date).toUTCString() : 'an earlier date'
  const who = message.from ? formatAddress(message.from) : 'unknown sender'
  const quoted = message.bodyHtml ? sanitizeOutgoingHtml(message.bodyHtml) : `<pre>${escapeHtml(plainBody(message))}</pre>`

  return (
    `<br /><div>On ${escapeHtml(when)}, ${escapeHtml(who)} wrote:</div>` +
    `<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${quoted}</blockquote>`
  )
}

/** HTML twin of forwardedBlock. */
function forwardedBlockHtml(message: MessageDetail): string {
  const rows = [
    ['From', message.from ? formatAddress(message.from) : 'unknown'],
    ['Date', message.date ? new Date(message.date).toUTCString() : 'unknown'],
    ['Subject', message.subject],
    ['To', message.to.map(formatAddress).join(', ')],
    ...(message.cc.length ? [['Cc', message.cc.map(formatAddress).join(', ')]] : []),
  ]
    .map(([label, value]) => `<div><b>${label}:</b> ${escapeHtml(value)}</div>`)
    .join('')

  const quoted = message.bodyHtml ? sanitizeOutgoingHtml(message.bodyHtml) : `<pre>${escapeHtml(plainBody(message))}</pre>`

  return `<br /><div>---------- Forwarded message ----------</div>${rows}<br />${quoted}`
}

function plainBody(message: MessageDetail): string {
  if (message.bodyText) return message.bodyText.trim()
  if (message.bodyHtml) return htmlToText(message.bodyHtml)
  return message.snippet
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

/** Translates Google API failures into ApiErrors the error handler understands. */
async function withGmailErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const gaxios = error as { code?: number | string; message?: string; response?: { data?: unknown } }
    const status = Number(gaxios.code)

    if (status === 401) {
      throw new ApiError(401, 'GMAIL_AUTH_EXPIRED', 'Gmail authorization expired. Please reconnect the account.')
    }
    if (status === 403) {
      throw new ApiError(403, 'GMAIL_FORBIDDEN', gaxios.message ?? 'Gmail refused the request (scope or quota).')
    }
    if (status === 404) {
      throw ApiError.notFound('That message no longer exists in the connected mailbox.')
    }
    if (status === 429) {
      throw new ApiError(429, 'GMAIL_RATE_LIMITED', 'Gmail rate limit hit. Try again in a moment.')
    }

    throw ApiError.upstream(gaxios.message ?? 'The Gmail API request failed.', gaxios.response?.data)
  }
}

export type GmailClient = gmail_v1.Gmail
