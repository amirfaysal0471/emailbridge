import { useEffect, useState } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { MessageList } from '@/components/mail/MessageList'
import { MessageView } from '@/components/mail/MessageView'
import { useMailbox } from '@/hooks/useMailbox'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { Mailbox, MessageDetail } from '@/types/mail'

interface MailboxPageProps {
  mailbox: Mailbox
  /** Lists a Gmail label (STARRED, IMPORTANT, Label_12…) instead of the plain mailbox. */
  labelId?: string
  title?: string
  onReply: (message: MessageDetail) => void
  onForward: (message: MessageDetail) => void
}

export function MailboxPage({ mailbox, labelId, title, onReply, onForward }: MailboxPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const mailboxQuery = useMailbox(mailbox, labelId)

  // Each mailbox or label keeps its own selection; switching clears the reading pane.
  useEffect(() => {
    setSelectedId(null)
  }, [mailbox, labelId])

  // Escape (handled globally in App) closes the reading pane.
  useEffect(() => {
    const onDeselect = () => setSelectedId(null)
    window.addEventListener('mailbridge:deselect', onDeselect)
    return () => window.removeEventListener('mailbridge:deselect', onDeselect)
  }, [])

  const list = (
    <MessageList
      mailbox={mailbox}
      messages={mailboxQuery.messages}
      isLoading={mailboxQuery.isLoading}
      isFetching={mailboxQuery.isFetching}
      error={mailboxQuery.error}
      selectedId={selectedId}
      onSelect={setSelectedId}
      pageIndex={mailboxQuery.pageIndex}
      hasNext={mailboxQuery.hasNext}
      hasPrevious={mailboxQuery.hasPrevious}
      onNext={mailboxQuery.goNext}
      onPrevious={mailboxQuery.goPrevious}
      onRefresh={() => void mailboxQuery.refresh()}
      search={mailboxQuery.search}
      title={title}
    />
  )

  const reader = (
    <MessageView
      messageId={selectedId}
      onReply={onReply}
      onForward={onForward}
      onBack={isDesktop ? undefined : () => setSelectedId(null)}
      onTrashed={() => setSelectedId(null)}
    />
  )

  if (!isDesktop) {
    // On small screens the two panes become one: list, then message.
    return <div className="h-full">{selectedId ? reader : list}</div>
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* String sizes are percentages in react-resizable-panels; numbers would mean pixels. */}
      <ResizablePanel defaultSize="34" minSize="26" maxSize="50">
        {list}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="66">{reader}</ResizablePanel>
    </ResizablePanelGroup>
  )
}
