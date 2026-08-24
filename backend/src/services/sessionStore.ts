import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { ACCOUNT_COOKIE, clearAccountCookie, setAccountCookie } from '../utils/cookies.js'
import { deleteAccount, getAccount, findAccountByEmail, saveAccount, updateTokens } from './tokenStore.js'
import type { ConnectedAccount, StoredTokens } from '../types/index.js'

/**
 * Where a connected account lives between requests.
 *
 * Two backends, same contract:
 *
 *  file   — a JSON file on disk, keyed by an opaque id in a signed cookie.
 *           Great locally: tokens never touch the browser at all.
 *
 *  cookie — the record itself, AES-256-GCM encrypted into the cookie.
 *           Required on serverless hosts (Vercel, Lambda), where the filesystem
 *           is read-only and no two requests share a process. The ciphertext is
 *           opaque to the browser and the cookie is httpOnly, so page scripts
 *           still cannot read the tokens — but they do travel with each request,
 *           which is the trade serverless forces.
 */
export type SessionBackend = 'file' | 'cookie'

/** Serverless platforms set these; the file store cannot work there. */
function detectBackend(): SessionBackend {
  if (env.SESSION_BACKEND !== 'auto') return env.SESSION_BACKEND
  const serverless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
  return serverless ? 'cookie' : 'file'
}

export const sessionBackend: SessionBackend = detectBackend()

// ── encryption ───────────────────────────────────────────────────────────────

const KEY = scryptSync(env.SESSION_SECRET, 'mailbridge.session.v1', 32)
const IV_BYTES = 12

function encrypt(payload: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const body = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

function decrypt(value: string): string | null {
  try {
    const raw = Buffer.from(value, 'base64url')
    const iv = raw.subarray(0, IV_BYTES)
    const tag = raw.subarray(IV_BYTES, IV_BYTES + 16)
    const body = raw.subarray(IV_BYTES + 16)
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  } catch {
    // Tampered, truncated, or encrypted under a rotated secret — treat as signed out.
    return null
  }
}

/**
 * id_token is a large JWT we never read after the initial profile lookup.
 * Dropping it keeps the cookie comfortably inside the 4 KB browser limit.
 */
function slimTokens(tokens: StoredTokens): StoredTokens {
  const { id_token: _idToken, ...rest } = tokens
  return rest
}

// ── public API ───────────────────────────────────────────────────────────────

export async function readAccount(req: Request): Promise<ConnectedAccount | null> {
  const cookie = req.signedCookies?.[ACCOUNT_COOKIE] as string | undefined
  if (!cookie) return null

  if (sessionBackend === 'file') return getAccount(cookie)

  const plaintext = decrypt(cookie)
  if (!plaintext) return null
  try {
    return JSON.parse(plaintext) as ConnectedAccount
  } catch {
    return null
  }
}

export async function writeAccount(
  res: Response,
  account: Omit<ConnectedAccount, 'id' | 'connectedAt'> & { id?: string; connectedAt?: string },
): Promise<ConnectedAccount> {
  if (sessionBackend === 'file') {
    const saved = await saveAccount(account)
    setAccountCookie(res, saved.id)
    return saved
  }

  const record: ConnectedAccount = {
    ...account,
    id: account.id ?? 'cookie-session',
    connectedAt: account.connectedAt ?? new Date().toISOString(),
    tokens: slimTokens(account.tokens),
  }
  setAccountCookie(res, encrypt(JSON.stringify(record)))
  return record
}

/** Persists credentials Google handed back during an automatic refresh. */
export async function persistRefreshedTokens(
  res: Response,
  account: ConnectedAccount,
  tokens: StoredTokens,
): Promise<void> {
  if (sessionBackend === 'file') {
    await updateTokens(account.id, tokens)
    return
  }

  const merged: ConnectedAccount = {
    ...account,
    tokens: slimTokens({
      ...account.tokens,
      ...tokens,
      refresh_token: tokens.refresh_token ?? account.tokens.refresh_token ?? null,
    }),
  }
  // Headers are already sent once a response is streaming; skip rather than throw.
  if (res.headersSent) return
  setAccountCookie(res, encrypt(JSON.stringify(merged)))
}

export async function clearSession(res: Response, account: ConnectedAccount | null): Promise<void> {
  if (sessionBackend === 'file' && account) await deleteAccount(account.id)
  clearAccountCookie(res)
}

/** Only the file store can look an account up by address; cookies are per-browser. */
export async function findExistingByEmail(email: string): Promise<ConnectedAccount | null> {
  if (sessionBackend !== 'file') return null
  return findAccountByEmail(email)
}
