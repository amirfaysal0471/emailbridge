import { z } from 'zod'

/** Accepts "a@b.com, c@d.com" or ["a@b.com"] and normalises to a trimmed array. */
const addressList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.email('Each recipient must be a valid email address.')))

const optionalAddressList = addressList.optional().default([])

export const composeSchema = z.object({
  to: addressList.refine((list) => list.length > 0, 'At least one recipient is required.'),
  cc: optionalAddressList,
  bcc: optionalAddressList,
  subject: z.string().max(998, 'Subject is too long.').default(''),
  body: z.string().min(1, 'Message body cannot be empty.'),
  bodyHtml: z.string().max(1_000_000).optional(),
})

export const replySchema = z.object({
  body: z.string().min(1, 'Reply body cannot be empty.'),
  bodyHtml: z.string().max(1_000_000).optional(),
  cc: optionalAddressList,
  bcc: optionalAddressList,
  replyAll: z.coerce.boolean().optional().default(false),
})

export const forwardSchema = z.object({
  to: addressList.refine((list) => list.length > 0, 'At least one recipient is required.'),
  cc: optionalAddressList,
  bcc: optionalAddressList,
  body: z.string().optional().default(''),
  bodyHtml: z.string().max(1_000_000).optional(),
})

export const listQuerySchema = z.object({
  pageToken: z.string().trim().min(1).optional(),
  maxResults: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().trim().min(1).max(200).optional(),
  /** Lists a specific label (STARRED, IMPORTANT, Label_12…) instead of the default mailbox. */
  labelId: z.string().trim().min(1).max(120).optional(),
})

export const starSchema = z.object({
  starred: z.coerce.boolean(),
})

export const readSchema = z.object({
  read: z.coerce.boolean(),
})

export type ComposePayload = z.infer<typeof composeSchema>
export type ReplyPayload = z.infer<typeof replySchema>
export type ForwardPayload = z.infer<typeof forwardSchema>
export type ListQuery = z.infer<typeof listQuerySchema>
export type StarPayload = z.infer<typeof starSchema>
export type ReadPayload = z.infer<typeof readSchema>
