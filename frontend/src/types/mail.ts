export interface EmailAddress {
  name?: string
  email: string
}

export interface MessageSummary {
  id: string
  threadId: string
  from: EmailAddress | null
  to: EmailAddress[]
  cc: EmailAddress[]
  subject: string
  snippet: string
  date: string | null
  unread: boolean
  starred: boolean
  hasAttachments: boolean
  labelIds: string[]
}

export interface Attachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

export interface MessageDetail extends MessageSummary {
  bcc: EmailAddress[]
  replyTo: EmailAddress[]
  bodyHtml: string | null
  bodyText: string | null
  attachments: Attachment[]
  messageIdHeader: string | null
  referencesHeader: string | null
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messagesTotal?: number
  messagesUnread?: number
}

export interface MessageListPage {
  messages: MessageSummary[]
  nextPageToken: string | null
  resultSizeEstimate: number
}

export interface AccountProfile {
  email: string
  name?: string
  picture?: string
  scopes: string[]
  connectedAt: string
  messagesTotal?: number
  threadsTotal?: number
}

/** Where the server keeps the session — decides what the UI may claim about tokens. */
export type SessionBackend = 'file' | 'cookie'

export interface AuthStatus {
  connected: boolean
  account: AccountProfile | null
  reason?: string
  sessionBackend?: SessionBackend
}

export interface SendResult {
  id: string
  threadId: string
  labelIds: string[]
  sentFrom: string
}

export type Mailbox = 'inbox' | 'sent'

export interface ComposePayload {
  to: string
  cc?: string
  bcc?: string
  subject: string
  /** Plain-text body — always sent, used for the text/plain part. */
  body: string
  /** Rich-text body from the compose editor, used for the text/html part. */
  bodyHtml?: string
  attachments?: File[]
}

export interface ReplyPayload {
  body: string
  bodyHtml?: string
  cc?: string
  bcc?: string
  replyAll?: boolean
  attachments?: File[]
}

export interface ForwardPayload {
  to: string
  cc?: string
  bcc?: string
  body?: string
  bodyHtml?: string
  attachments?: File[]
}
