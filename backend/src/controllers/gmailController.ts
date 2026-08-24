import type { Request, Response } from 'express'
import {
  forwardMessage,
  getAttachment,
  getMessage,
  getProfile,
  listLabels,
  listMessages,
  markAsRead,
  replyToMessage,
  sendMessage,
  setRead,
  setStarred,
  trashMessage,
  untrashMessage,
} from '../services/gmailService.js'
import { collectAttachments } from '../middleware/upload.js'
import { ApiError } from '../utils/ApiError.js'
import type {
  ComposePayload,
  ForwardPayload,
  ListQuery,
  ReadPayload,
  ReplyPayload,
  StarPayload,
} from '../utils/schemas.js'
import type { ConnectedAccount } from '../types/index.js'

/** requireAccount runs before every handler here, so the account is always present. */
function account(req: Request): ConnectedAccount {
  if (!req.account) throw ApiError.unauthorized()
  return req.account
}

/** Express 5 types route params as string | string[]; these are always single values. */
function param(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

function query(res: Response): ListQuery {
  return res.locals.query as ListQuery
}

/** Gmail account information via users.getProfile — §"Gmail Account Information". */
export async function getGmailProfile(req: Request, res: Response): Promise<void> {
  res.json(await getProfile(account(req)))
}

export async function getInbox(req: Request, res: Response): Promise<void> {
  const { pageToken, maxResults, q, labelId } = query(res)
  res.json(await listMessages(account(req), { mailbox: 'INBOX', labelId, pageToken, maxResults, query: q }))
}

export async function getSent(req: Request, res: Response): Promise<void> {
  const { pageToken, maxResults, q } = query(res)
  res.json(await listMessages(account(req), { mailbox: 'SENT', pageToken, maxResults, query: q }))
}

/** Labels with unread counts — drives the sidebar. */
export async function getLabels(req: Request, res: Response): Promise<void> {
  res.json({ labels: await listLabels(account(req)) })
}

export async function postStar(req: Request, res: Response): Promise<void> {
  const { starred } = req.body as StarPayload
  res.json(await setStarred(account(req), param(req, 'messageId'), starred))
}

export async function postRead(req: Request, res: Response): Promise<void> {
  const { read } = req.body as ReadPayload
  res.json(await setRead(account(req), param(req, 'messageId'), read))
}

/** Reversible: Gmail keeps trashed mail for 30 days, and /untrash restores it. */
export async function postTrash(req: Request, res: Response): Promise<void> {
  await trashMessage(account(req), param(req, 'messageId'))
  res.json({ trashed: true, messageId: param(req, 'messageId') })
}

export async function postUntrash(req: Request, res: Response): Promise<void> {
  res.json(await untrashMessage(account(req), param(req, 'messageId')))
}

export async function getMessageDetail(req: Request, res: Response): Promise<void> {
  const current = account(req)
  const message = await getMessage(current, param(req, 'messageId'))

  // Opening a message in the app mirrors opening it in Gmail.
  if (message.unread) {
    await markAsRead(current, message.id).catch((cause: unknown) =>
      console.warn('[mail] could not clear UNREAD label:', cause),
    )
    message.unread = false
    message.labelIds = message.labelIds.filter((label) => label !== 'UNREAD')
  }

  res.json(message)
}

export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  const current = account(req)
  const messageId = param(req, 'messageId')
  const attachmentId = param(req, 'attachmentId')

  const message = await getMessage(current, messageId)
  const meta = message.attachments.find((attachment) => attachment.attachmentId === attachmentId)
  if (!meta) throw ApiError.notFound('That attachment is not part of this message.')

  const buffer = await getAttachment(current, messageId, attachmentId)

  res.setHeader('Content-Type', meta.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.filename)}"`)
  res.send(buffer)
}

export async function postSend(req: Request, res: Response): Promise<void> {
  const payload = req.body as ComposePayload
  const result = await sendMessage(account(req), { ...payload, attachments: collectAttachments(req) })
  res.status(201).json({ ...result, sentFrom: account(req).email })
}

export async function postReply(req: Request, res: Response): Promise<void> {
  const payload = req.body as ReplyPayload
  const result = await replyToMessage(account(req), param(req, 'messageId'), {
    ...payload,
    attachments: collectAttachments(req),
  })
  res.status(201).json({ ...result, sentFrom: account(req).email })
}

export async function postForward(req: Request, res: Response): Promise<void> {
  const payload = req.body as ForwardPayload
  const result = await forwardMessage(account(req), param(req, 'messageId'), {
    ...payload,
    attachments: collectAttachments(req),
  })
  res.status(201).json({ ...result, sentFrom: account(req).email })
}
