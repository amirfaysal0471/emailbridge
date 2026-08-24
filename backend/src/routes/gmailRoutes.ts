import { Router } from 'express'
import {
  downloadAttachment,
  getGmailProfile,
  getInbox,
  getLabels,
  getMessageDetail,
  getSent,
  postForward,
  postRead,
  postReply,
  postSend,
  postStar,
  postTrash,
  postUntrash,
} from '../controllers/gmailController.js'
import { requireAccount } from '../middleware/requireAccount.js'
import { acceptAttachments } from '../middleware/upload.js'
import { validateBody, validateQuery } from '../middleware/validate.js'
import {
  composeSchema,
  forwardSchema,
  listQuerySchema,
  readSchema,
  replySchema,
  starSchema,
} from '../utils/schemas.js'

const router = Router()

// Everything below needs a connected mailbox.
router.use(requireAccount)

router.get('/profile', getGmailProfile)
router.get('/labels', getLabels)

router.get('/inbox', validateQuery(listQuerySchema), getInbox)
router.get('/sent', validateQuery(listQuerySchema), getSent)

router.get('/messages/:messageId', getMessageDetail)
router.get('/messages/:messageId/attachments/:attachmentId', downloadAttachment)

// Message actions
router.post('/messages/:messageId/star', validateBody(starSchema), postStar)
router.post('/messages/:messageId/read', validateBody(readSchema), postRead)
router.post('/messages/:messageId/trash', postTrash)
router.post('/messages/:messageId/untrash', postUntrash)

// Sending. acceptAttachments parses multipart/form-data; JSON bodies pass straight through.
router.post('/send', acceptAttachments, validateBody(composeSchema), postSend)
router.post('/reply/:messageId', acceptAttachments, validateBody(replySchema), postReply)
router.post('/forward/:messageId', acceptAttachments, validateBody(forwardSchema), postForward)

export default router
