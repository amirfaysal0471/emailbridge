import multer from 'multer'
import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import type { OutgoingAttachment } from '../utils/mime.js'

/** Gmail rejects messages over 25 MB, so there is no point accepting more. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const MAX_ATTACHMENTS = 5

/**
 * Attachments arrive as multipart/form-data and are held in memory only long
 * enough to be base64-encoded into the MIME message — nothing touches disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: MAX_ATTACHMENTS },
})

/**
 * Accepts an optional `attachments` file field.
 *
 * Requests with a JSON body skip multer entirely, so the same route serves both
 * `application/json` and `multipart/form-data` clients.
 */
export function acceptAttachments(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    next()
    return
  }

  upload.array('attachments', MAX_ATTACHMENTS)(req, res, (error: unknown) => {
    if (!error) {
      next()
      return
    }
    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? `Each attachment must be under ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`
          : error.code === 'LIMIT_FILE_COUNT'
            ? `At most ${MAX_ATTACHMENTS} attachments per message.`
            : error.message
      next(ApiError.badRequest(message))
      return
    }
    next(error)
  })
}

/** Normalises multer's files into the shape the MIME builder expects. */
export function collectAttachments(req: Request): OutgoingAttachment[] {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  return files.map((file) => ({
    filename: file.originalname,
    mimeType: file.mimetype || 'application/octet-stream',
    content: file.buffer,
  }))
}
