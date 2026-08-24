import type { ReactNode } from 'react'
import { useState } from 'react'
import { Mail, Menu, PenSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ConnectedAccountCard } from '@/components/layout/ConnectedAccountCard'
import { HeaderSearch } from '@/components/layout/HeaderSearch'
import { MailboxNav } from '@/components/layout/MailboxNav'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSidebarCollapsed } from '@/hooks/useSidebar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AccountProfile } from '@/types/mail'

interface AppShellProps {
  account: AccountProfile
  onCompose: () => void
  children: ReactNode
}

export function AppShell({ account, onCompose, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // One hamburger, two jobs: opens the drawer on mobile, narrows the rail on desktop.
  const onMenuClick = () => (isDesktop ? toggleCollapsed() : setDrawerOpen(true))

  const sidebar = (railed: boolean, onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4 overflow-y-auto py-3">
      <MailboxNav onCompose={onCompose} onNavigate={onNavigate} collapsed={railed} />
      <div className={cn('mt-auto', railed ? 'px-2' : 'px-3')}>
        <ConnectedAccountCard account={account} collapsed={railed} />
      </div>
    </div>
  )

  return (
    <div className="bg-background flex h-dvh flex-col">
      {/* App bar: brand on the left, search taking the centre, account on the right. */}
      <header className="bg-muted/40 flex h-16 shrink-0 items-center gap-2 px-2 sm:px-4">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Toggle navigation">
                <Menu className="size-5" />
              </Button>
            }
          />
          <TooltipContent side="bottom">{isDesktop ? 'Collapse or expand' : 'Open navigation'}</TooltipContent>
        </Tooltip>

        <div className="mr-2 flex shrink-0 items-center gap-2 sm:w-[184px]">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Mail className="size-4" />
          </div>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">MailBridge</span>
        </div>

        <div className="min-w-0 max-w-2xl flex-1">
          <HeaderSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger
              render={
                <button type="button" className="rounded-full" aria-label={`Connected as ${account.email}`}>
                  <Avatar className="size-8">
                    {account.picture && <AvatarImage src={account.picture} alt="" />}
                    <AvatarFallback className="text-[10px] font-semibold">
                      {initials({ email: account.email, name: account.name })}
                    </AvatarFallback>
                  </Avatar>
                </button>
              }
            />
            <TooltipContent side="bottom">
              <p className="font-medium">Connected Gmail</p>
              <p className="text-xs">{account.email}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'bg-muted/40 hidden shrink-0 transition-[width] duration-200 md:block',
            collapsed ? 'w-[72px]' : 'w-[248px]',
          )}
        >
          {sidebar(collapsed)}
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile: the same navigation as a drawer, always expanded. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="bg-muted/40 w-72 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <Mail className="size-3.5" />
              </div>
              MailBridge
            </SheetTitle>
          </SheetHeader>
          {sidebar(false, () => setDrawerOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Mobile compose stays reachable without opening the drawer.
          Sits above the list's pagination bar so it never covers those controls. */}
      <Button
        size="icon"
        onClick={onCompose}
        aria-label="Compose"
        className="fixed right-4 bottom-16 z-40 size-14 rounded-full shadow-lg md:hidden"
      >
        <PenSquare className="size-5" />
      </Button>
    </div>
  )
}
