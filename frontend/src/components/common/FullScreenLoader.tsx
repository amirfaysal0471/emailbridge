import { Loader2 } from 'lucide-react'

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}
