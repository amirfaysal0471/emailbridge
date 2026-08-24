import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { env, isProduction } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { ENDPOINTS, renderLandingPage } from './views/landing.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  // Same-origin deployments need no CORS at all; a split deployment must name
  // the exact frontend origin, because credentialed requests forbid a wildcard.
  if (!env.SAME_ORIGIN) {
    app.use(
      cors({
        origin: env.FRONTEND_URL,
        credentials: true, // the account cookie must ride along with API calls
      }),
    )
  }
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser(env.SESSION_SECRET))
  app.use(morgan(isProduction ? 'combined' : 'dev'))

  // Gmail enforces its own quotas; this keeps a runaway frontend from burning them.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down a moment.' } },
    }),
  )

  // Root: a status page for browsers, a machine-readable index for everything else.
  app.get('/', (req, res) => {
    if (req.accepts(['html', 'json']) === 'html') {
      res.type('html').send(renderLandingPage(process.uptime()))
      return
    }
    res.json({
      service: 'MailBridge API',
      status: 'ok',
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      app: env.FRONTEND_URL,
      docs: 'docs/api.md',
      endpoints: ENDPOINTS.flatMap((group) =>
        group.routes.map((route) => ({ ...route, group: group.title })),
      ),
    })
  })

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
