import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarTone, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EmailAddress } from '@/types/mail'

interface SenderAvatarProps {
  address: EmailAddress | null | undefined
  src?: string
  className?: string
}

export function SenderAvatar({ address, src, className }: SenderAvatarProps) {
  const seed = address?.email ?? 'unknown'

  return (
    <Avatar className={cn('size-9', className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn('text-xs font-semibold', avatarTone(seed))}>{initials(address)}</AvatarFallback>
    </Avatar>
  )
}
