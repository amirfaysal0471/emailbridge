import { format, isThisYear, isToday, isYesterday } from 'date-fns'
import type { EmailAddress } from '@/types/mail'

/** Gmail-style date column: time today, weekday recently, full date otherwise. */
export function formatListDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return 'Yesterday'
  if (isThisYear(date)) return format(date, 'MMM d')
  return format(date, 'MMM d, yyyy')
}

export function formatFullDate(value: string | null): string {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return format(date, "EEE, MMM d, yyyy 'at' h:mm a")
}

export function displayName(address: EmailAddress | null | undefined): string {
  if (!address) return 'Unknown sender'
  return address.name?.trim() || address.email
}

export function initials(address: EmailAddress | null | undefined): string {
  const source = displayName(address)
  const words = source.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/)
  if (!words[0]) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export function formatAddressList(addresses: EmailAddress[], max = 3): string {
  if (!addresses.length) return '—'
  const shown = addresses.slice(0, max).map(displayName).join(', ')
  const rest = addresses.length - max
  return rest > 0 ? `${shown} +${rest} more` : shown
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

/** Deterministic accent colour per sender so avatars stay recognisable between renders. */
export function avatarTone(seed: string): string {
  const tones = [
    'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return tones[hash % tones.length]
}
