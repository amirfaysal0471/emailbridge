import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldRowProps {
  htmlFor: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

/** Keeps every compose field aligned, labelled and wired for screen readers. */
export function FieldRow({ htmlFor, label, hint, error, children, className }: FieldRowProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label
          id={`${htmlFor}-label`}
          htmlFor={htmlFor}
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          {label}
        </Label>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
