import { Paperclip, Star } from 'lucide-react'
import { SenderAvatar } from '@/components/common/SenderAvatar'
import { displayName, formatListDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Mailbox, MessageSummary } from '@/types/mail'

interface MessageListItemProps {
  message: MessageSummary
  mailbox: Mailbox
  selected: boolean
  onSelect: (id: string) => void
  onToggleStar: (message: MessageSummary) => void
}

export function MessageListItem({ message, mailbox, selected, onSelect, onToggleStar }: MessageListItemProps) {
  // The interesting party is the sender in Inbox and the recipient in Sent.
  const counterpart = mailbox === 'sent' ? (message.to[0] ?? null) : message.from
  const prefix = mailbox === 'sent' ? 'To: ' : ''

  return (
    <li className="relative">
      {/* Sits outside the row button — nested buttons are invalid HTML. */}
      <button
        type="button"
        onClick={() => onToggleStar(message)}
        aria-label={message.starred ? `Unstar "${message.subject}"` : `Star "${message.subject}"`}
        aria-pressed={message.starred}
        className="hover:bg-muted focus-visible:ring-ring absolute top-2.5 right-2 z-10 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        <Star
          className={cn(
            'size-3.5 transition-colors',
            message.starred ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40 hover:text-muted-foreground',
          )}
        />
      </button>

      <button
        type="button"
        onClick={() => onSelect(message.id)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'focus-visible:ring-ring flex w-full gap-3 px-4 py-2.5 text-left transition-shadow focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2',
          'hover:relative hover:z-10 hover:shadow-[inset_0_0_0_1px_var(--border),0_1px_3px_0_rgb(0_0_0/0.12)]',
          message.unread ? 'bg-background' : 'bg-muted/30',
          selected && 'bg-secondary',
        )}
      >
        <SenderAvatar address={counterpart} className="size-8" />
        {message.unread && <span className="sr-only">Unread</span>}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn('truncate text-[13px]', message.unread ? 'font-bold' : 'font-normal')}>
              {prefix}
              {displayName(counterpart)}
            </span>
            <span
              className={cn(
                'ml-auto shrink-0 pr-7 text-xs tabular-nums',
                message.unread ? 'text-foreground font-bold' : 'text-muted-foreground',
              )}
            >
              {formatListDate(message.date)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn('truncate text-[13px]', message.unread ? 'font-bold' : 'text-foreground/80')}>
              {message.subject}
            </span>
            {message.hasAttachments && <Paperclip className="text-muted-foreground size-3.5 shrink-0" />}
          </div>

          <p className="text-muted-foreground truncate text-xs">{message.snippet}</p>
        </div>

      </button>
    </li>
  )
}
