import type { NextFunction, Request, Response } from 'express'
import { persistRefreshedTokens, readAccount } from '../services/sessionStore.js'
import { ApiError } from '../utils/ApiError.js'
import type { ConnectedAccount } from '../types/index.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: ConnectedAccount
    }
  }
}

/** Resolves the session cookie into a connected account, or 401s. */
export async function requireAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  const account = await readAccount(req)

  if (!account) {
    next(ApiError.unauthorized())
    return
  }
  if (!account.tokens.refresh_token && !account.tokens.access_token) {
    next(new ApiError(401, 'GMAIL_AUTH_EXPIRED', 'Stored credentials are incomplete. Please reconnect Gmail.'))
    return
  }

  // google-auth-library refreshes tokens mid-request; this is how the new ones
  // get written back, whichever session backend is in play.
  account.onTokensRefreshed = (tokens) => persistRefreshedTokens(res, account, tokens)

  req.account = account
  next()
}
