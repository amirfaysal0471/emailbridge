import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { ComposeDialog, type ComposeState } from '@/components/mail/ComposeDialog'
import { FullScreenLoader } from '@/components/common/FullScreenLoader'
import { StateBlock } from '@/components/common/StateBlock'
import { ShortcutsDialog } from '@/components/layout/ShortcutsDialog'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ConnectPage } from '@/pages/ConnectPage'
import { LabelPage } from '@/pages/LabelPage'
import { MailboxPage } from '@/pages/MailboxPage'
import { useAuthStatus } from '@/hooks/useAuth'
import { toErrorMessage } from '@/api/client'
import type { MessageDetail } from '@/types/mail'

export default function App() {
  const { data: status, isLoading, error, refetch } = useAuthStatus()
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [pendingG, setPendingG] = useState(false)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  // The OAuth callback redirects back with ?connected=1 — acknowledge it once.
  useEffect(() => {
    if (params.get('connected') !== '1') return
    toast.success('Gmail connected')
    const next = new URLSearchParams(params)
    next.delete('connected')
    setParams(next, { replace: true })
    navigate('/inbox', { replace: true })
  }, [params, setParams, navigate])

  const openReply = useCallback((message: MessageDetail) => setCompose({ mode: 'reply', message }), [])
  const openForward = useCallback((message: MessageDetail) => setCompose({ mode: 'forward', message }), [])
  const openCompose = useCallback(() => setCompose({ mode: 'compose' }), [])

  // Gmail-style two-key sequences: `g` arms, the next key picks the destination.
  const shortcuts = useMemo(
    () => ({
      c: () => openCompose(),
      g: () => setPendingG(true),
      i: () => pendingG && navigate('/inbox'),
      s: () => pendingG && navigate('/sent'),
      '/': () => {
        const search = document.querySelector<HTMLInputElement>('input[aria-label^="Search"]')
        search?.focus()
      },
      r: () => window.dispatchEvent(new CustomEvent('mailbridge:refresh')),
      '?': () => setShortcutsOpen(true),
      escape: () => window.dispatchEvent(new CustomEvent('mailbridge:deselect')),
    }),
    [openCompose, navigate, pendingG],
  )

  // While a dialog is open it owns the keyboard — including Escape to dismiss it.
  useKeyboardShortcuts(shortcuts, !compose && !shortcutsOpen)

  // The `g` prefix only stays armed briefly, so a stray press cannot hijack a later key.
  useEffect(() => {
    if (!pendingG) return
    const timer = setTimeout(() => setPendingG(false), 1200)
    return () => clearTimeout(timer)
  }, [pendingG])

  if (isLoading) return <FullScreenLoader label="Checking Gmail connection…" />

  if (error) {
    return (
      <div className="min-h-dvh">
        <StateBlock
          tone="danger"
          title="Cannot reach the MailBridge API"
          description={toErrorMessage(error)}
          action={{ label: 'Retry', onClick: () => void refetch() }}
          className="min-h-dvh"
        />
      </div>
    )
  }

  if (!status?.connected || !status.account) {
    return (
      <Routes>
        <Route path="*" element={<ConnectPage sessionBackend={status?.sessionBackend} />} />
      </Routes>
    )
  }

  // Keying on the address discards every cached list and draft when the
  // connected mailbox changes, so one account's mail can never bleed into another's.

  return (
    <div key={status.account.email} className="contents">
      <AppShell account={status.account} onCompose={openCompose}>
        <Routes>
          <Route path="/inbox" element={<MailboxPage mailbox="inbox" onReply={openReply} onForward={openForward} />} />
          <Route
            path="/starred"
            element={
              <MailboxPage
                mailbox="inbox"
                labelId="STARRED"
                title="starred"
                onReply={openReply}
                onForward={openForward}
              />
            }
          />
          <Route path="/sent" element={<MailboxPage mailbox="sent" onReply={openReply} onForward={openForward} />} />
          <Route path="/label/:labelId" element={<LabelPage onReply={openReply} onForward={openForward} />} />
          <Route path="*" element={<Navigate to="/inbox" replace />} />
        </Routes>
      </AppShell>

      <ComposeDialog state={compose} onClose={() => setCompose(null)} connectedEmail={status.account.email} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}
