import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Gmail's search lives in the app bar, not in the list, and its query lives in
 * the URL. Keeping `?q=` as the source of truth means a search survives
 * navigation between mailboxes, and the result is a shareable link.
 */
export function HeaderSearch() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [draft, setDraft] = useState(query)
  const [focused, setFocused] = useState(false)

  // Someone else changed the URL (back button, label switch) — follow it.
  useEffect(() => {
    setDraft(query)
  }, [query])

  // Debounce so a Gmail search is not issued on every keystroke.
  useEffect(() => {
    if (draft === query) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (draft) next.set('q', draft)
      else next.delete('q')
      setParams(next, { replace: true })
    }, 400)
    return () => clearTimeout(timer)
  }, [draft, query, params, setParams])

  const clear = () => {
    setDraft('')
    const next = new URLSearchParams(params)
    next.delete('q')
    setParams(next, { replace: true })
  }

  return (
    <div
      className={cn(
        'flex h-12 w-full items-center gap-2 rounded-full px-3 transition-colors',
        focused ? 'bg-background shadow-md' : 'bg-secondary/70 hover:bg-secondary',
      )}
    >
      <Search className="text-muted-foreground size-4 shrink-0" />

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search mail"
        aria-label="Search mail"
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
      />

      {draft && (
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={clear} aria-label="Clear search">
          <X className="size-4" />
        </Button>
      )}

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-7 shrink-0 sm:flex"
              aria-label="Search options"
              onClick={() => setDraft((current) => (current ? current : 'is:unread '))}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          }
        />
        <TooltipContent side="bottom">
          <p>Gmail search operators work here</p>
          <p className="text-xs opacity-80">is:unread · from:someone@x.com · has:attachment</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
