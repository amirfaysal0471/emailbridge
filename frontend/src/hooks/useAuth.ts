import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { disconnectGmail, fetchAuthStatus } from '@/api/auth'
import { queryKeys } from '@/lib/queryKeys'
import type { AuthStatus } from '@/types/mail'

export function useAuthStatus() {
  return useQuery<AuthStatus>({
    queryKey: queryKeys.authStatus,
    queryFn: fetchAuthStatus,
    // Who is connected is authoritative on the server: re-check on every mount
    // and whenever the tab regains focus, so the UI can never sit on a stale
    // account after a disconnect, a token expiry, or a backend restart.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

export function useDisconnect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disconnectGmail,
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.authStatus, status)
      // Nothing cached is valid once the mailbox is gone — drop every mailbox,
      // message and label entry so a later connection starts from a clean slate.
      queryClient.removeQueries({ queryKey: ['gmail'] })
    },
  })
}
