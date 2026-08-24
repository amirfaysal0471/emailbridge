import { Router } from 'express'
import authRoutes from './authRoutes.js'
import gmailRoutes from './gmailRoutes.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

router.use('/auth', authRoutes)
router.use('/gmail', gmailRoutes)

export default router
