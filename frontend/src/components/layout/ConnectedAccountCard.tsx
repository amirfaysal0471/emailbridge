import { useState } from 'react'
import { LogOut, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDisconnect } from '@/hooks/useAuth'
import { toErrorMessage } from '@/api/client'
import { initials } from '@/lib/format'
import type { AccountProfile } from '@/types/mail'

/**
 * The "Connected Gmail" panel: which mailbox is authorized, and the way out.
 * Always visible in the sidebar rather than hidden behind a menu, so a client
 * watching the demo can see at a glance whose account is being used.
 */
interface ConnectedAccountCardProps {
  account: AccountProfile
  /** Rail mode: avatar only, with the details moved into a tooltip. */
  collapsed?: boolean
}

export function ConnectedAccountCard({ account, collapsed = false }: ConnectedAccountCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const disconnect = useDisconnect()

  const avatar = (
    <Avatar className="size-8 shrink-0">
      {account.picture && <AvatarImage src={account.picture} alt="" />}
      <AvatarFallback className="text-[10px] font-semibold">
        {initials({ email: account.email, name: account.name })}
      </AvatarFallback>
    </Avatar>
  )

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync()
      setConfirmOpen(false)
      toast.success('Gmail disconnected', { description: 'Access was revoked at Google and tokens were deleted.' })
    } catch (error) {
      toast.error('Could not disconnect', { description: toErrorMessage(error) })
    }
  }

  if (collapsed) {
    return (
      <>
        <div className="flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger render={<div>{avatar}</div>} />
            <TooltipContent side="right">
              <p className="font-medium">Connected Gmail</p>
              <p className="text-xs">{account.email}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setConfirmOpen(true)}
                  aria-label="Disconnect Gmail"
                >
                  <LogOut className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Disconnect Gmail</TooltipContent>
          </Tooltip>
        </div>

        <DisconnectDialog
          account={account}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          pending={disconnect.isPending}
          onConfirm={handleDisconnect}
        />
      </>
    )
  }

  return (
    <>
      <section aria-label="Connected Gmail account" className="space-y-3 rounded-xl border p-3">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">Connected Gmail</p>

        <div className="flex items-center gap-2.5">
          {avatar}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={account.email}>
              {account.email}
            </p>
            {account.name && <p className="text-muted-foreground truncate text-xs">{account.name}</p>}
          </div>
        </div>

        <dl className="text-muted-foreground space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt>Connected</dt>
            <dd className="text-foreground">{new Date(account.connectedAt).toLocaleDateString()}</dd>
          </div>
          {typeof account.messagesTotal === 'number' && (
            <div className="flex justify-between gap-2">
              <dt>Messages</dt>
              <dd className="text-foreground tabular-nums">{account.messagesTotal.toLocaleString()}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt>Scopes</dt>
            <dd className="text-foreground">{account.scopes.length} granted</dd>
          </div>
        </dl>

        <Button variant="outline" size="sm" className="w-full" onClick={() => setConfirmOpen(true)}>
          <LogOut className="size-4" />
          Disconnect Gmail
        </Button>
      </section>

      <DisconnectDialog
        account={account}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pending={disconnect.isPending}
        onConfirm={handleDisconnect}
      />
    </>
  )
}

function DisconnectDialog({
  account,
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  account: AccountProfile
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect {account.email}?</DialogTitle>
          <DialogDescription>
            The stored access and refresh tokens are deleted and the authorization is revoked at Google. You can
            reconnect at any time by granting access again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            <ShieldCheck className="size-4" />
            {pending ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
