import type { CookieOptions, Response } from 'express'
import { env, isProduction } from '../config/env.js'

export const ACCOUNT_COOKIE = 'mb_account'
export const OAUTH_STATE_COOKIE = 'mb_oauth_state'

/**
 * httpOnly keeps the cookie out of JavaScript and signed detects tampering.
 *
 * SameSite depends on the deployment shape. Same-origin (the app and API behind
 * one domain) gets 'lax', which is stricter and still survives Google's redirect
 * back into the callback. A split deployment — React on one host, API on another
 * — needs 'none' so the browser attaches the cookie to cross-site XHR at all,
 * and 'none' is only honoured alongside Secure, hence HTTPS in production.
 */
const crossSite = isProduction && !env.SAME_ORIGIN

const baseOptions: CookieOptions = {
  httpOnly: true,
  signed: true,
  sameSite: crossSite ? 'none' : 'lax',
  secure: crossSite || isProduction,
  path: '/',
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
const TEN_MINUTES = 10 * 60 * 1000

export function setAccountCookie(res: Response, accountId: string): void {
  res.cookie(ACCOUNT_COOKIE, accountId, { ...baseOptions, maxAge: THIRTY_DAYS })
}

export function clearAccountCookie(res: Response): void {
  res.clearCookie(ACCOUNT_COOKIE, baseOptions)
}

export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, { ...baseOptions, maxAge: TEN_MINUTES })
}

export function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE, baseOptions)
}
