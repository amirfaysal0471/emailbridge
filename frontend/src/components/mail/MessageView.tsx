import { ArrowLeft, Download, Forward, Mail, MailOpen, Paperclip, Reply, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SenderAvatar } from '@/components/common/SenderAvatar'
import { StateBlock } from '@/components/common/StateBlock'
import { MessageBody } from '@/components/mail/MessageBody'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMessage } from '@/hooks/useMessage'
import { useMessageActions } from '@/hooks/useMessageActions'
import { attachmentUrl } from '@/api/mail'
import { toErrorMessage } from '@/api/client'
import { displayName, formatAddressList, formatBytes, formatFullDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MessageDetail } from '@/types/mail'

interface MessageViewProps {
  messageId: string | null
  onReply: (message: MessageDetail) => void
  onForward: (message: MessageDetail) => void
  onBack?: () => void
  /** Called after the message is trashed, so the parent can clear the reading pane. */
  onTrashed?: () => void
}

export function MessageView({ messageId, onReply, onForward, onBack, onTrashed }: MessageViewProps) {
  const { data: message, isLoading, error, refetch } = useMessage(messageId)
  const { star, read, trash } = useMessageActions()

  if (!messageId) {
    return (
      <StateBlock
        icon={<MailOpen className="size-5" />}
        title="No message selected"
        description="Pick a message from the list to read it here."
      />
    )
  }

  if (isLoading) return <MessageViewSkeleton />

  if (error || !message) {
    return (
      <StateBlock
        tone="danger"
        title="Could not open this message"
        description={toErrorMessage(error)}
        action={{ label: 'Try again', onClick: () => void refetch() }}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 border-b px-4 py-3 sm:px-6">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to list" className="lg:hidden">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <h2 className="min-w-0 flex-1 text-base font-semibold text-balance">{message.subject}</h2>

        <div className="flex shrink-0 items-center gap-1">
          <IconAction
            label={message.starred ? 'Remove star' : 'Add star'}
            onClick={() => star.mutate({ messageId: message.id, starred: !message.starred })}
          >
            <Star
              className={cn('size-4', message.starred ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')}
            />
          </IconAction>

          <IconAction
            label="Mark as unread"
            onClick={() => {
              read.mutate({ messageId: message.id, read: false })
              onBack?.()
            }}
          >
            <Mail className="text-muted-foreground size-4" />
          </IconAction>

          <IconAction
            label="Move to Trash"
            onClick={() =>
              trash.mutate(message.id, {
                onSuccess: () => onTrashed?.(),
              })
            }
          >
            <Trash2 className="text-muted-foreground size-4" />
          </IconAction>

          <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />

          <Button variant="outline" size="sm" onClick={() => onReply(message)} aria-label="Reply">
            <Reply className="size-4" />
            <span className="hidden sm:inline">Reply</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onForward(message)} aria-label="Forward">
            <Forward className="size-4" />
            <span className="hidden sm:inline">Forward</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4 sm:px-6">
          <header className="flex gap-3">
            <SenderAvatar address={message.from} className="size-10" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{displayName(message.from)}</span>
                {message.from?.name && (
                  <span className="text-muted-foreground text-xs">&lt;{message.from.email}&gt;</span>
                )}
              </div>
              <dl className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                <div className="flex gap-1.5">
                  <dt className="shrink-0">To:</dt>
                  <dd className="truncate">{formatAddressList(message.to)}</dd>
                </div>
                {message.cc.length > 0 && (
                  <div className="flex gap-1.5">
                    <dt className="shrink-0">Cc:</dt>
                    <dd className="truncate">{formatAddressList(message.cc)}</dd>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <dt className="shrink-0">Date:</dt>
                  <dd>{formatFullDate(message.date)}</dd>
                </div>
              </dl>
            </div>
          </header>

          {message.attachments.length > 0 && (
            <section aria-label="Attachments" className="space-y-2">
              <Separator />
              <ul className="flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <li key={attachment.attachmentId}>
                    <a
                      href={attachmentUrl(message.id, attachment.attachmentId)}
                      download={attachment.filename}
                      className="hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors"
                    >
                      <Paperclip className="text-muted-foreground size-3.5" />
                      <span className="max-w-40 truncate font-medium">{attachment.filename}</span>
                      <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                      <Download className="text-muted-foreground size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Separator />
          <MessageBody message={message} />
        </div>
      </ScrollArea>
    </div>
  )
}

/** Icon-only button with a tooltip — keeps the header compact without losing labels. */
function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" onClick={onClick} aria-label={label}>
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function MessageViewSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-3.5" style={{ width: `${90 - index * 7}%` }} />
        ))}
      </div>
    </div>
  )
}
