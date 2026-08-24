import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env.js'
import type { ConnectedAccount } from '../types/index.js'

/**
 * Scopes the demo requests. Keep this list as small as the feature set allows —
 * every extra scope makes Google's verification review harder later.
 *
 *  openid / email / profile  → identify which Gmail account was connected
 *  gmail.modify              → read inbox + sent mail, mark messages as read, and
 *                              send / reply / forward (users.messages.send accepts
 *                              gmail.modify, so a separate gmail.send is redundant)
 */
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
]

/**
 * Scopes the app cannot work without.
 *
 * Google's consent screen lets people untick individual permissions, and it
 * still returns an authorization code for whatever they did grant. Without
 * these two the connection is useless, so the callback checks them up front
 * rather than letting the first Gmail call fail with a confusing 403.
 */
export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
]

/** Friendly names, for telling someone exactly which box they left unticked. */
export const SCOPE_LABELS: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.modify': 'Read, compose and send email',
  'https://www.googleapis.com/auth/userinfo.email': 'See your primary Google Account email address',
}

/** Which required scopes are absent from what Google actually granted. */
export function findMissingScopes(granted: string | null | undefined): string[] {
  const set = new Set((granted ?? '').split(' ').filter(Boolean))
  return REQUIRED_SCOPES.filter((scope) => !set.has(scope))
}

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
}

export function buildAuthUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent', // force the consent screen so a refresh token is always issued
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

/**
 * Returns an OAuth client bound to a stored account.
 *
 * google-auth-library refreshes an expired access token automatically before a
 * request; the `tokens` event fires with the new credentials, and we write them
 * back to the store so the refresh survives a server restart.
 */
export function getAuthorizedClient(account: ConnectedAccount): OAuth2Client {
  const client = createOAuthClient()
  // Stored JSON uses null for absent values; google-auth-library wants undefined.
  client.setCredentials({ ...account.tokens, scope: account.tokens.scope ?? undefined })

  client.on('tokens', (tokens) => {
    void Promise.resolve(account.onTokensRefreshed?.(tokens)).catch((error: unknown) => {
      console.error(`[oauth] failed to persist refreshed tokens for ${account.email}:`, error)
    })
  })

  return client
}

export function getGmailClient(account: ConnectedAccount) {
  return google.gmail({ version: 'v1', auth: getAuthorizedClient(account) })
}

/**
 * Revokes the grant at Google so the app disappears from the user's account page.
 *
 * This is deliberately only reachable from an explicit Disconnect. Google
 * invalidates every token it issued to this client for this user, so calling it
 * anywhere else would sign the person out of sessions they never asked to end.
 */
export async function revokeTokens(account: ConnectedAccount): Promise<void> {
  const token = account.tokens.refresh_token || account.tokens.access_token
  if (!token) return
  await createOAuthClient().revokeToken(token)
}
