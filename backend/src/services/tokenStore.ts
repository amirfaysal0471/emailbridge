import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import type { ConnectedAccount, StoredTokens } from '../types/index.js'

/**
 * Token persistence for the demo.
 *
 * Tokens live on disk in a JSON file and are keyed by an opaque account id.
 * The browser only ever receives that id, inside a signed httpOnly cookie —
 * access tokens and refresh tokens never cross the network to the frontend.
 *
 * A real deployment should swap this file for an encrypted column in a
 * database; every caller goes through this module, so that is a local change.
 */

type StoreShape = Record<string, ConnectedAccount>

const storePath = path.resolve(process.cwd(), env.TOKEN_STORE_PATH)

let cache: StoreShape | null = null
let writeQueue: Promise<void> = Promise.resolve()

async function load(): Promise<StoreShape> {
  if (cache) return cache
  try {
    const raw = await readFile(storePath, 'utf8')
    cache = JSON.parse(raw) as StoreShape
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    cache = {}
  }
  return cache
}

/** Serialised, atomic write so concurrent token refreshes cannot corrupt the file. */
function persist(): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const snapshot = JSON.stringify(cache ?? {}, null, 2)
    await mkdir(path.dirname(storePath), { recursive: true })
    const tmp = `${storePath}.${randomUUID()}.tmp`
    await writeFile(tmp, snapshot, { mode: 0o600 })
    await rename(tmp, storePath)
  })
  return writeQueue
}

export async function getAccount(accountId: string | undefined): Promise<ConnectedAccount | null> {
  if (!accountId) return null
  const store = await load()
  return store[accountId] ?? null
}

export async function findAccountByEmail(email: string): Promise<ConnectedAccount | null> {
  const store = await load()
  return Object.values(store).find((account) => account.email === email) ?? null
}

export async function saveAccount(
  account: Omit<ConnectedAccount, 'id' | 'connectedAt'> & { id?: string; connectedAt?: string },
): Promise<ConnectedAccount> {
  const store = await load()
  const id = account.id ?? randomUUID()
  const existing = store[id]

  const record: ConnectedAccount = {
    ...account,
    id,
    connectedAt: account.connectedAt ?? existing?.connectedAt ?? new Date().toISOString(),
    tokens: {
      // Google omits refresh_token on repeat consents — keep the one we already hold.
      ...existing?.tokens,
      ...account.tokens,
      refresh_token: account.tokens.refresh_token ?? existing?.tokens.refresh_token ?? null,
    },
  }

  store[id] = record
  await persist()
  return record
}

export async function updateTokens(accountId: string, tokens: StoredTokens): Promise<void> {
  const store = await load()
  const account = store[accountId]
  if (!account) return
  account.tokens = {
    ...account.tokens,
    ...tokens,
    refresh_token: tokens.refresh_token ?? account.tokens.refresh_token ?? null,
  }
  await persist()
}

export async function deleteAccount(accountId: string): Promise<ConnectedAccount | null> {
  const store = await load()
  const account = store[accountId]
  if (!account) return null
  delete store[accountId]
  await persist()
  return account
}
