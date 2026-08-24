import { api } from './client'
import type { AuthStatus } from '@/types/mail'

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const { data } = await api.get<AuthStatus>('/auth/status')
  return data
}

export async function disconnectGmail(): Promise<AuthStatus> {
  const { data } = await api.post<AuthStatus>('/auth/disconnect')
  return data
}

/**
 * Full-page navigation, not fetch: Google's consent screen must be shown in a
 * top-level browsing context, and it redirects back to the backend callback.
 */
export function startGmailConnect(): void {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api'
  window.location.href = `${base}/auth/google`
}
