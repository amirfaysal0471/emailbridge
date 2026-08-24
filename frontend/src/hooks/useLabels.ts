import { useQuery } from '@tanstack/react-query'
import { fetchLabels } from '@/api/mail'
import { queryKeys } from '@/lib/queryKeys'
import type { GmailLabel } from '@/types/mail'

/** System labels the sidebar renders itself, so they are filtered out of the custom list. */
const SIDEBAR_SYSTEM_LABELS = new Set(['INBOX', 'SENT', 'STARRED', 'IMPORTANT', 'TRASH'])

export function useLabels() {
  const query = useQuery<GmailLabel[]>({
    queryKey: queryKeys.labels,
    queryFn: fetchLabels,
    staleTime: 60_000,
  })

  const labels = query.data ?? []

  return {
    ...query,
    labels,
    userLabels: labels.filter((label) => label.type === 'user'),
    systemLabels: labels.filter((label) => label.type === 'system' && SIDEBAR_SYSTEM_LABELS.has(label.id)),
    byId: (id: string) => labels.find((label) => label.id === id),
    unreadFor: (id: string) => labels.find((label) => label.id === id)?.messagesUnread ?? 0,
  }
}
