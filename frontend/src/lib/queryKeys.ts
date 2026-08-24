import type { Mailbox } from '@/types/mail'

/** Central key factory so invalidations after a send cannot drift from the queries. */
export const queryKeys = {
  authStatus: ['auth', 'status'] as const,
  gmailProfile: ['gmail', 'profile'] as const,
  labels: ['gmail', 'labels'] as const,
  mailbox: (mailbox: Mailbox, pageToken: string | null, query: string, labelId: string | null) =>
    ['gmail', mailbox, pageToken ?? 'first', query, labelId ?? 'default'] as const,
  mailboxAll: (mailbox: Mailbox) => ['gmail', mailbox] as const,
  message: (messageId: string) => ['gmail', 'message', messageId] as const,
}
