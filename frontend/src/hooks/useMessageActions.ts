import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  setMessageRead,
  setMessageStarred,
  trashMessage,
  untrashMessage,
} from '@/api/mail'
import { toErrorMessage } from '@/api/client'
import { queryKeys } from '@/lib/queryKeys'
import type { MessageDetail, MessageListPage, MessageSummary } from '@/types/mail'

/**
 * Star / read / trash actions with optimistic updates.
 *
 * Each mutation rewrites the cached list rows immediately so the UI reacts on
 * click, then rolls back if Gmail rejects the change.
 */
export function useMessageActions() {
  const queryClient = useQueryClient()

  /** Patches a message wherever it appears — every cached list page and its detail entry. */
  const patchCaches = (messageId: string, patch: Partial<MessageSummary>) => {
    queryClient.setQueriesData<MessageListPage>({ queryKey: ['gmail'] }, (page) => {
      if (!page?.messages) return page
      if (!page.messages.some((message) => message.id === messageId)) return page
      return {
        ...page,
        messages: page.messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
      }
    })
    queryClient.setQueryData<MessageDetail>(queryKeys.message(messageId), (detail) =>
      detail ? { ...detail, ...patch } : detail,
    )
  }

  const snapshot = () => queryClient.getQueriesData<MessageListPage>({ queryKey: ['gmail'] })

  const restore = (previous: ReturnType<typeof snapshot>) => {
    for (const [key, value] of previous) queryClient.setQueryData(key, value)
  }

  const star = useMutation({
    mutationFn: ({ messageId, starred }: { messageId: string; starred: boolean }) =>
      setMessageStarred(messageId, starred),
    onMutate: async ({ messageId, starred }) => {
      const previous = snapshot()
      patchCaches(messageId, { starred })
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) restore(context.previous)
      toast.error('Could not update the star', { description: toErrorMessage(error) })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.labels })
    },
  })

  const read = useMutation({
    mutationFn: ({ messageId, read: isRead }: { messageId: string; read: boolean }) =>
      setMessageRead(messageId, isRead),
    onMutate: async ({ messageId, read: isRead }) => {
      const previous = snapshot()
      patchCaches(messageId, { unread: !isRead })
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) restore(context.previous)
      toast.error('Could not change the read state', { description: toErrorMessage(error) })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.labels })
    },
  })

  const trash = useMutation({
    mutationFn: (messageId: string) => trashMessage(messageId),
    onSuccess: (_data, messageId) => {
      void queryClient.invalidateQueries({ queryKey: ['gmail'] })
      toast.success('Moved to Trash', {
        description: 'Gmail keeps it for 30 days.',
        action: {
          label: 'Undo',
          onClick: () => {
            untrashMessage(messageId)
              .then(() => {
                void queryClient.invalidateQueries({ queryKey: ['gmail'] })
                toast.success('Message restored')
              })
              .catch((error: unknown) =>
                toast.error('Could not restore the message', { description: toErrorMessage(error) }),
              )
          },
        },
      })
    },
    onError: (error) => toast.error('Could not move to Trash', { description: toErrorMessage(error) }),
  })

  return { star, read, trash }
}
