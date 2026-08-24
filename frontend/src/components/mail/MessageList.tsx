import { ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageListItem } from '@/components/mail/MessageListItem'
import { MessageListSkeleton } from '@/components/common/MessageListSkeleton'
import { StateBlock } from '@/components/common/StateBlock'
import { toErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'
import { useMessageActions } from '@/hooks/useMessageActions'
import type { Mailbox, MessageSummary } from '@/types/mail'

interface MessageListProps {
  mailbox: Mailbox
  messages: MessageSummary[]
  isLoading: boolean
  isFetching: boolean
  error: unknown
  selectedId: string | null
  onSelect: (id: string) => void
  pageIndex: number
  hasNext: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
  onRefresh: () => void
  /** Read-only here — the app-bar search owns the query via the URL. */
  search: string
  title?: string
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function MessageList(props: MessageListProps) {
  const { mailbox, messages, isLoading, isFetching, error, selectedId, onSelect } = props
  const { star } = useMessageActions()
  const scope = props.title ?? mailbox

  // The `r` shortcut lives in App; the list is what actually knows how to refresh.
  useEffect(() => {
    const onRefresh = () => props.onRefresh()
    window.addEventListener('mailbridge:refresh', onRefresh)
    return () => window.removeEventListener('mailbridge:refresh', onRefresh)
  }, [props])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="flex-1 truncate text-sm font-semibold">
          {props.search ? <>Results in <span className="capitalize">{scope}</span></> : <span className="capitalize">{scope}</span>}
        </h2>

        {props.search && (
          <span className="text-muted-foreground truncate text-xs" title={props.search}>
            “{props.search}”
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={props.onRefresh}
          disabled={isFetching}
          aria-label="Refresh mailbox"
          title="Refresh"
        >
          <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <MessageListSkeleton />
        ) : error ? (
          <StateBlock
            tone="danger"
            title="Could not load this mailbox"
            description={toErrorMessage(error)}
            action={{ label: 'Try again', onClick: props.onRefresh }}
          />
        ) : messages.length === 0 ? (
          <StateBlock
            icon={<Inbox className="size-5" />}
            title={props.search ? 'No matching messages' : `${capitalize(scope)} is empty`}
            description={
              props.search
                ? 'Try a different search term, or clear the search to see everything.'
                : 'Messages will appear here once this mailbox has mail.'
            }
          />
        ) : (
          <ul className="divide-border/60 divide-y">
            {messages.map((message) => (
              <MessageListItem
                key={message.id}
                message={message}
                mailbox={mailbox}
                selected={message.id === selectedId}
                onSelect={onSelect}
                onToggleStar={(target) => star.mutate({ messageId: target.id, starred: !target.starred })}
              />
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between border-t px-3 py-2">
        <span className="text-muted-foreground text-xs">Page {props.pageIndex + 1}</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={props.onPrevious}
            disabled={!props.hasPrevious || isFetching}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={props.onNext}
            disabled={!props.hasNext || isFetching}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
