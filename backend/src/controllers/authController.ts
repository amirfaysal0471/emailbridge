import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import {
  GOOGLE_SCOPES,
  SCOPE_LABELS,
  buildAuthUrl,
  exchangeCodeForTokens,
  findMissingScopes,
  revokeTokens,
} from '../lib/googleClient.js'
import {
  clearSession,
  findExistingByEmail,
  readAccount,
  sessionBackend,
  writeAccount,
} from '../services/sessionStore.js'
import { fetchUserInfo, getProfile } from '../services/gmailService.js'
import { ApiError } from '../utils/ApiError.js'
import {
  OAUTH_STATE_COOKIE,
  clearAccountCookie,
  clearOAuthStateCookie,
  setOAuthStateCookie,
} from '../utils/cookies.js'

/** Step 1 — send the browser to Google's consent screen. */
export function startOAuth(_req: Request, res: Response): void {
  const state = randomBytes(24).toString('hex')
  setOAuthStateCookie(res, state)
  res.redirect(buildAuthUrl(state))
}

/**
 * Step 2 — Google redirects back here with ?code and ?state.
 *
 * The code is exchanged for tokens server-side; the browser only ever gets an
 * opaque account id in a signed httpOnly cookie.
 */
export async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string | undefined>
  const expectedState = req.signedCookies?.[OAUTH_STATE_COOKIE] as string | undefined
  clearOAuthStateCookie(res)

  if (error) return redirectToFrontend(res, { error })
  if (!code) return redirectToFrontend(res, { error: 'missing_code' })
  if (!state || !expectedState || !safeEqual(state, expectedState)) {
    return redirectToFrontend(res, { error: 'state_mismatch' })
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.access_token) return redirectToFrontend(res, { error: 'token_exchange_failed' })

    // Consent is per-permission: someone can untick a box and still come back
    // with a code. A grant missing these is not something we can work with.
    //
    // The partial token is simply discarded, never revoked. Google's revoke
    // endpoint invalidates every token issued to this client for this user —
    // so revoking here would sign out a perfectly good session that the same
    // person established earlier in another tab. Re-consenting replaces the
    // grant anyway, so there is nothing to clean up.
    const missing = findMissingScopes(tokens.scope)
    if (missing.length) {
      console.warn(`[oauth] partial consent, discarding grant. Missing: ${missing.join(', ')}`)
      return redirectToFrontend(res, {
        error: 'insufficient_scope',
        missing: missing.map((scope) => SCOPE_LABELS[scope] ?? scope).join(' · '),
      })
    }

    const profile = await fetchUserInfo({ id: 'pending', email: '', tokens })
    if (!profile.email) return redirectToFrontend(res, { error: 'profile_unavailable' })

    // Reconnecting the same mailbox updates the existing record instead of piling up copies.
    const existing = await findExistingByEmail(profile.email)

    await writeAccount(res, {
      id: existing?.id,
      email: profile.email,
      name: profile.name ?? undefined,
      picture: profile.picture ?? undefined,
      scopes: tokens.scope ? tokens.scope.split(' ') : GOOGLE_SCOPES,
      tokens,
    })

    redirectToFrontend(res, { connected: '1' })
  } catch (cause) {
    console.error('[oauth] callback failed:', cause)
    redirectToFrontend(res, { error: 'oauth_failed' })
  }
}

/** Tells the frontend whether a mailbox is connected, and which one. */
export async function getStatus(req: Request, res: Response): Promise<void> {
  const account = await readAccount(req)

  if (!account) {
    res.json({ connected: false, account: null, sessionBackend })
    return
  }

  try {
    res.json({ connected: true, account: await getProfile(account), sessionBackend })
  } catch (cause) {
    // Stored tokens exist but Gmail rejected them — surface it as "not connected".
    if (cause instanceof ApiError && cause.status === 401) {
      clearAccountCookie(res)
      res.json({ connected: false, account: null, reason: cause.code, sessionBackend })
      return
    }
    throw cause
  }
}

export async function disconnect(req: Request, res: Response): Promise<void> {
  const account = await readAccount(req)

  if (account) {
    try {
      await revokeTokens(account)
    } catch (cause) {
      // A token Google already invalidated still needs to disappear locally.
      console.warn('[oauth] revoke failed, removing local record anyway:', cause)
    }
  }

  await clearSession(res, account)
  res.json({ connected: false, account: null })
}

/**
 * Sends the browser back to the React app after the OAuth round trip.
 *
 * Same-origin deployments redirect to a path, so the app is reachable no matter
 * which domain or preview URL served the request. Split deployments need the
 * absolute FRONTEND_URL.
 */
function redirectToFrontend(res: Response, params: Record<string, string>): void {
  const query = new URLSearchParams(params).toString()

  if (env.SAME_ORIGIN) {
    res.redirect(`/?${query}`)
    return
  }

  const url = new URL(env.FRONTEND_URL)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  res.redirect(url.toString())
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
