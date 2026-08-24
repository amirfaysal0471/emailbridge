import axios, { AxiosError } from 'axios'

/**
 * Single axios instance for the whole app.
 *
 * `withCredentials` matters: the connected mailbox is identified by an httpOnly
 * cookie the backend sets, and the browser only attaches it when asked to.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  timeout: 30_000,
})

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/** Turns any axios failure into a message worth showing a human. */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    if (body?.error?.message) return body.error.message
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
    if (!error.response) return 'Cannot reach the API server. Is the backend running?'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function errorCode(error: unknown): string | null {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    return body?.error?.code ?? null
  }
  return null
}
