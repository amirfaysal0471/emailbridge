import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMailbox } from '@/api/mail'
import { queryKeys } from '@/lib/queryKeys'
import type { Mailbox, MessageListPage } from '@/types/mail'

const PAGE_SIZE = 20

/**
 * Gmail paginates with opaque forward-only page tokens, so "previous page"
 * means replaying the tokens already visited. The cursor stack does exactly
 * that: index 0 is the first page (no token), each Next pushes the token Gmail
 * returned for the following page.
 */
export function useMailbox(mailbox: Mailbox, labelId?: string) {
  const queryClient = useQueryClient()
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  // The query lives in the URL so the app-bar search can drive every mailbox.
  const [params] = useSearchParams()
  const search = params.get('q') ?? ''

  // Switching mailbox, label or search starts a fresh pagination run.
  useEffect(() => {
    setCursors([null])
    setPageIndex(0)
  }, [mailbox, labelId, search])

  const pageToken = cursors[pageIndex] ?? null

  const query = useQuery<MessageListPage>({
    queryKey: queryKeys.mailbox(mailbox, pageToken, search, labelId ?? null),
    queryFn: () =>
      fetchMailbox(mailbox, {
        pageToken: pageToken ?? undefined,
        maxResults: PAGE_SIZE,
        q: search || undefined,
        labelId,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const nextPageToken = query.data?.nextPageToken ?? null

  const goNext = useCallback(() => {
    if (!nextPageToken) return
    setCursors((current) => (current[pageIndex + 1] ? current : [...current.slice(0, pageIndex + 1), nextPageToken]))
    setPageIndex((index) => index + 1)
  }, [nextPageToken, pageIndex])

  const goPrevious = useCallback(() => {
    setPageIndex((index) => Math.max(0, index - 1))
  }, [])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.mailboxAll(mailbox) })
  }, [mailbox, queryClient])

  return useMemo(
    () => ({
      ...query,
      messages: query.data?.messages ?? [],
      pageIndex,
      pageSize: PAGE_SIZE,
      hasNext: Boolean(nextPageToken),
      hasPrevious: pageIndex > 0,
      goNext,
      goPrevious,
      refresh,
      search,
    }),
    [query, pageIndex, nextPageToken, goNext, goPrevious, refresh, search],
  )
}
