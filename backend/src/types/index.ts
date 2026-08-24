export interface StoredTokens {
  access_token?: string | null
  refresh_token?: string | null
  scope?: string | null
  token_type?: string | null
  /** Epoch milliseconds at which the access token expires. */
  expiry_date?: number | null
  id_token?: string | null
}

export interface ConnectedAccount {
  /** Opaque id handed to the browser in a signed, httpOnly cookie. */
  id: string
  email: string
  name?: string
  picture?: string
  scopes: string[]
  connectedAt: string
  tokens: StoredTokens
  /**
   * Set per request by requireAccount. Called when Google issues fresh
   * credentials during an automatic refresh so the session can be rewritten.
   * Not serialised — it is a runtime-only hook.
   */
  onTokensRefreshed?: (tokens: StoredTokens) => void | Promise<void>
}

/** Shape returned to the frontend — never includes tokens. */
export interface AccountProfile {
  email: string
  name?: string
  picture?: string
  scopes: string[]
  connectedAt: string
  messagesTotal?: number
  threadsTotal?: number
}

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
