import { api } from './client'
import type {
  AccountProfile,
  ComposePayload,
  ForwardPayload,
  GmailLabel,
  Mailbox,
  MessageDetail,
  MessageListPage,
  MessageSummary,
  ReplyPayload,
  SendResult,
} from '@/types/mail'

export interface ListParams {
  pageToken?: string
  maxResults?: number
  q?: string
  labelId?: string
}

/** Gmail account information, straight from users.getProfile. */
export async function fetchGmailProfile(): Promise<AccountProfile> {
  const { data } = await api.get<AccountProfile>('/gmail/profile')
  return data
}

export async function fetchLabels(): Promise<GmailLabel[]> {
  const { data } = await api.get<{ labels: GmailLabel[] }>('/gmail/labels')
  return data.labels
}

export async function fetchMailbox(mailbox: Mailbox, params: ListParams = {}): Promise<MessageListPage> {
  const { data } = await api.get<MessageListPage>(`/gmail/${mailbox}`, { params })
  return data
}

export async function fetchMessage(messageId: string): Promise<MessageDetail> {
  const { data } = await api.get<MessageDetail>(`/gmail/messages/${messageId}`)
  return data
}

export async function setMessageStarred(messageId: string, starred: boolean): Promise<MessageSummary> {
  const { data } = await api.post<MessageSummary>(`/gmail/messages/${messageId}/star`, { starred })
  return data
}

export async function setMessageRead(messageId: string, read: boolean): Promise<MessageSummary> {
  const { data } = await api.post<MessageSummary>(`/gmail/messages/${messageId}/read`, { read })
  return data
}

export async function trashMessage(messageId: string): Promise<void> {
  await api.post(`/gmail/messages/${messageId}/trash`)
}

export async function untrashMessage(messageId: string): Promise<MessageSummary> {
  const { data } = await api.post<MessageSummary>(`/gmail/messages/${messageId}/untrash`)
  return data
}

/**
 * Sends as JSON when there are no files, and as multipart/form-data when there
 * are — the backend accepts both on the same route.
 */
function toRequestBody(payload: Record<string, unknown>, attachments?: File[]) {
  if (!attachments?.length) return payload

  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue
    form.append(key, String(value))
  }
  for (const file of attachments) form.append('attachments', file, file.name)
  return form
}

export async function sendEmail({ attachments, ...payload }: ComposePayload): Promise<SendResult> {
  const { data } = await api.post<SendResult>('/gmail/send', toRequestBody(payload, attachments))
  return data
}

export async function replyToEmail(
  messageId: string,
  { attachments, ...payload }: ReplyPayload,
): Promise<SendResult> {
  const { data } = await api.post<SendResult>(`/gmail/reply/${messageId}`, toRequestBody(payload, attachments))
  return data
}

export async function forwardEmail(
  messageId: string,
  { attachments, ...payload }: ForwardPayload,
): Promise<SendResult> {
  const { data } = await api.post<SendResult>(`/gmail/forward/${messageId}`, toRequestBody(payload, attachments))
  return data
}

export function attachmentUrl(messageId: string, attachmentId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api'
  return `${base}/gmail/messages/${messageId}/attachments/${attachmentId}`
}
