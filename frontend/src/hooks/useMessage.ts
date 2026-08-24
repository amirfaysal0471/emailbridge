import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMessage, forwardEmail, replyToEmail, sendEmail } from '@/api/mail'
import { queryKeys } from '@/lib/queryKeys'
import type { ComposePayload, ForwardPayload, MessageDetail, ReplyPayload } from '@/types/mail'

export function useMessage(id: string | null) {
  return useQuery<MessageDetail>({
    queryKey: queryKeys.message(id ?? ''),
    queryFn: () => fetchMessage(id as string),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

/** Anything that sends mail should refresh Sent, and Inbox for read-state changes. */
function useInvalidateAfterSend() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['gmail'] })
  }
}

export function useSendEmail() {
  const invalidate = useInvalidateAfterSend()
  return useMutation({
    mutationFn: (payload: ComposePayload) => sendEmail(payload),
    onSuccess: invalidate,
  })
}

export function useReplyToEmail() {
  const invalidate = useInvalidateAfterSend()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReplyPayload }) => replyToEmail(id, payload),
    onSuccess: invalidate,
  })
}

export function useForwardEmail() {
  const invalidate = useInvalidateAfterSend()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ForwardPayload }) => forwardEmail(id, payload),
    onSuccess: invalidate,
  })
}
