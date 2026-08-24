import { Router } from 'express'
import { disconnect, getStatus, handleOAuthCallback, startOAuth } from '../controllers/authController.js'

const router = Router()

router.get('/google', startOAuth)
router.get('/google/callback', handleOAuthCallback)
router.get('/status', getStatus)
router.post('/disconnect', disconnect)

export default router
