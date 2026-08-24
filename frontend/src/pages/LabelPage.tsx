import { useParams } from 'react-router-dom'
import { MailboxPage } from '@/pages/MailboxPage'
import { useLabels } from '@/hooks/useLabels'
import type { MessageDetail } from '@/types/mail'

interface LabelPageProps {
  onReply: (message: MessageDetail) => void
  onForward: (message: MessageDetail) => void
}

/** Renders any Gmail label through the same list/reader shell the inbox uses. */
export function LabelPage({ onReply, onForward }: LabelPageProps) {
  const { labelId = '' } = useParams()
  const { byId } = useLabels()
  const label = byId(labelId)

  return (
    <MailboxPage
      key={labelId}
      mailbox="inbox"
      labelId={labelId}
      title={label?.name ?? 'label'}
      onReply={onReply}
      onForward={onForward}
    />
  )
}
