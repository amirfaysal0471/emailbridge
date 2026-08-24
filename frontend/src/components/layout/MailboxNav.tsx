import type { ReactNode } from 'react'
import { Inbox, PenSquare, SendHorizontal, Star, Tag } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLabels } from '@/hooks/useLabels'
import { cn } from '@/lib/utils'

const PRIMARY = [
  { to: '/inbox', label: 'Inbox', icon: Inbox, labelId: 'INBOX' },
  { to: '/starred', label: 'Starred', icon: Star, labelId: 'STARRED' },
  { to: '/sent', label: 'Sent', icon: SendHorizontal, labelId: null },
] as const

interface MailboxNavProps {
  onCompose: () => void
  onNavigate?: () => void
  /** Icon-only rail. Desktop only — the mobile drawer is always expanded. */
  collapsed?: boolean
}

export function MailboxNav({ onCompose, onNavigate, collapsed = false }: MailboxNavProps) {
  const { userLabels, unreadFor, isLoading } = useLabels()

  return (
    <div className={cn('space-y-3', collapsed ? 'px-2' : 'pr-3')}>
      <div className={cn(collapsed ? '' : 'pl-2')}>
        <ComposeButton collapsed={collapsed} onClick={onCompose} />
      </div>

      <nav aria-label="Mailboxes" className="space-y-0.5">
        {PRIMARY.map(({ to, label, icon: Icon, labelId }) => (
          <NavItem
            key={to}
            to={to}
            label={label}
            collapsed={collapsed}
            onNavigate={onNavigate}
            icon={<Icon className="size-4 shrink-0" />}
            unread={labelId ? unreadFor(labelId) : 0}
          />
        ))}
      </nav>

      {(isLoading || userLabels.length > 0) && (
        <div className="space-y-0.5">
          {collapsed ? (
            <div className="flex justify-center py-1" aria-hidden="true">
              <span className="bg-border h-px w-6" />
            </div>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 px-4 pt-2 pb-1 text-[13px] font-medium">
              <Tag className="size-3.5" />
              Labels
            </p>
          )}

          {isLoading ? (
            <div className={cn('space-y-2 py-1', collapsed ? 'px-2' : 'px-4')}>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ) : (
            <nav aria-label="Gmail labels" className="space-y-0.5">
              {userLabels.map((label) => (
                <NavItem
                  key={label.id}
                  to={`/label/${encodeURIComponent(label.id)}`}
                  label={label.name}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  icon={
                    collapsed ? (
                      <span className="text-[10px] font-bold">{label.name.slice(0, 2).toUpperCase()}</span>
                    ) : (
                      <span className="bg-muted-foreground/40 size-2 shrink-0 rounded-full" />
                    )
                  }
                  unread={label.messagesUnread ?? 0}
                />
              ))}
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

function ComposeButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon"
              variant="secondary"
              className="mx-auto flex size-12 rounded-2xl shadow-sm"
              onClick={onClick}
            >
              <PenSquare className="size-4" />
              <span className="sr-only">Compose</span>
            </Button>
          }
        />
        <TooltipContent side="right">Compose</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      variant="secondary"
      className="h-12 w-full justify-start gap-3 rounded-2xl pl-4 text-sm font-medium shadow-sm"
      onClick={onClick}
    >
      <PenSquare className="size-4" />
      Compose
    </Button>
  )
}

interface NavItemProps {
  to: string
  label: string
  icon: ReactNode
  unread: number
  collapsed: boolean
  onNavigate?: () => void
}

function NavItem({ to, label, icon, unread, collapsed, onNavigate }: NavItemProps) {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          // Gmail's signature shape: the pill runs to the sidebar's left edge.
          'relative flex items-center transition-colors',
          collapsed
            ? 'mx-auto size-10 justify-center rounded-full'
            : 'h-8 gap-4 rounded-r-full pr-4 pl-4 text-[13px]',
          isActive
            ? 'bg-secondary text-secondary-foreground font-bold'
            : 'text-foreground/80 hover:bg-muted font-normal',
        )
      }
    >
      {icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {unread > 0 &&
        (collapsed ? (
          <span
            aria-hidden="true"
            className="bg-primary ring-background absolute top-1 right-1 size-2 rounded-full ring-2"
          />
        ) : (
          <span className="shrink-0 text-xs font-bold tabular-nums">{unread.toLocaleString()}</span>
        ))}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger render={<div>{link}</div>} />
      <TooltipContent side="right">
        {label}
        {unread > 0 && ` · ${unread} unread`}
      </TooltipContent>
    </Tooltip>
  )
}
