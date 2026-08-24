import { Skeleton } from '@/components/ui/skeleton'

export function MessageListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="divide-border divide-y" aria-label="Loading messages">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  )
}
