import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface StateBlockProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: { label: string; onClick: () => void; loading?: boolean }
  tone?: 'muted' | 'danger'
  className?: string
}

/** One component for every empty / error / nothing-selected panel in the app. */
export function StateBlock({ icon, title, description, action, tone = 'muted', className }: StateBlockProps) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div
        className={cn(
          'flex size-11 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon ?? <AlertCircle className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} disabled={action.loading}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
