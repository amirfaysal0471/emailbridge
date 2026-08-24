import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Paperclip, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/mail/RichTextEditor'
import { useForwardEmail, useReplyToEmail, useSendEmail } from '@/hooks/useMessage'
import { toErrorMessage } from '@/api/client'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EmailAddress, MessageDetail } from '@/types/mail'

export type ComposeMode = 'compose' | 'reply' | 'forward'

export interface ComposeState {
  mode: ComposeMode
  message?: MessageDetail | null
}

interface ComposeDialogProps {
  state: ComposeState | null
  onClose: () => void
  connectedEmail: string
}

interface FormState {
  to: string
  cc: string
  bcc: string
  subject: string
  /** HTML from the editor — becomes the message's text/html part. */
  bodyHtml: string
  /** Plain-text mirror of the same content, for the text/plain alternative. */
  body: string
  replyAll: boolean
}

const EMPTY_FORM: FormState = { to: '', cc: '', bcc: '', subject: '', bodyHtml: '', body: '', replyAll: false }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Gmail caps a message at 25 MB including encoding overhead. */
const MAX_TOTAL_BYTES = 25 * 1024 * 1024
const MAX_FILES = 5

const TITLES: Record<ComposeMode, string> = {
  compose: 'New message',
  reply: 'Reply',
  forward: 'Forward',
}

export function ComposeDialog({ state, onClose, connectedEmail }: ComposeDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sendMutation = useSendEmail()
  const replyMutation = useReplyToEmail()
  const forwardMutation = useForwardEmail()

  const mode = state?.mode ?? 'compose'
  const original = state?.message ?? null
  const isPending = sendMutation.isPending || replyMutation.isPending || forwardMutation.isPending

  // Reply and forward inherit their recipient and subject from the original message.
  const derived = useMemo(() => {
    if (!original) return { to: '', subject: '' }
    if (mode === 'reply') {
      const target = original.replyTo[0] ?? original.from
      return { to: target ? formatContact(target) : '', subject: prefixed(original.subject, 'Re:') }
    }
    if (mode === 'forward') return { to: '', subject: prefixed(original.subject, 'Fwd:') }
    return { to: '', subject: '' }
  }, [mode, original])

  useEffect(() => {
    if (!state) return
    setForm({ ...EMPTY_FORM, subject: derived.subject })
    setErrors({})
    setShowCc(false)
    setShowBcc(false)
    setAttachments([])
  }, [state, derived.subject])

  const update = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const updateBody = ({ html, text }: { html: string; text: string }) => {
    setForm((current) => ({ ...current, bodyHtml: html, body: text }))
    setErrors((current) => ({ ...current, body: undefined }))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}

    if (mode !== 'reply') {
      const recipients = splitAddresses(form.to)
      if (!recipients.length) next.to = 'Add at least one recipient.'
      else if (recipients.some((address) => !EMAIL_PATTERN.test(address)))
        next.to = 'One of these is not a valid email address.'
    }
    for (const field of ['cc', 'bcc'] as const) {
      const list = splitAddresses(form[field])
      if (list.some((address) => !EMAIL_PATTERN.test(address)))
        next[field] = 'One of these is not a valid email address.'
    }
    if (mode !== 'forward' && !form.body.trim()) next.body = 'Write something before sending.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const totalBytes = attachments.reduce((sum, file) => sum + file.size, 0)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return
    const merged = [...attachments]

    for (const file of Array.from(incoming)) {
      // Same name and size twice is almost certainly a double-pick.
      if (merged.some((existing) => existing.name === file.name && existing.size === file.size)) continue
      merged.push(file)
    }

    if (merged.length > MAX_FILES) {
      toast.error(`At most ${MAX_FILES} attachments per message`)
      return
    }
    if (merged.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
      toast.error('Attachments exceed the 25 MB Gmail limit')
      return
    }

    setAttachments(merged)
  }

  const removeFile = (index: number) => setAttachments((files) => files.filter((_, i) => i !== index))

  const handleSend = async () => {
    if (!validate()) return

    try {
      const shared = {
        cc: form.cc || undefined,
        bcc: form.bcc || undefined,
        bodyHtml: form.bodyHtml || undefined,
        attachments: attachments.length ? attachments : undefined,
      }

      if (mode === 'reply' && original) {
        await replyMutation.mutateAsync({
          id: original.id,
          payload: { body: form.body, replyAll: form.replyAll, ...shared },
        })
      } else if (mode === 'forward' && original) {
        await forwardMutation.mutateAsync({ id: original.id, payload: { to: form.to, body: form.body, ...shared } })
      } else {
        await sendMutation.mutateAsync({ to: form.to, subject: form.subject, body: form.body, ...shared })
      }

      toast.success('Message sent', { description: `Delivered from ${connectedEmail}` })
      onClose()
    } catch (error) {
      toast.error('Could not send the message', { description: toErrorMessage(error) })
    }
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[88dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {/* Title bar — deliberately compact, the way a mail client's composer reads. */}
        <header className="bg-muted/60 flex h-11 shrink-0 items-center gap-2 border-b px-4">
          <DialogTitle className="flex-1 text-sm font-semibold">{TITLES[mode]}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => !isPending && onClose()}
            aria-label="Close composer"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <HeaderRow label="From">
            <span className="text-muted-foreground truncate text-sm">{connectedEmail}</span>
          </HeaderRow>

          <HeaderRow label="To" error={errors.to}>
            {mode === 'reply' ? (
              <span className="text-muted-foreground truncate text-sm">{derived.to}</span>
            ) : (
              <input
                id="compose-to"
                value={form.to}
                onChange={(event) => update('to', event.target.value)}
                placeholder="Recipients, separated by commas"
                autoComplete="off"
                aria-label="To"
                aria-invalid={Boolean(errors.to)}
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            )}

            <div className="flex shrink-0 items-center gap-1">
              {mode === 'reply' && (
                <FieldToggle active={form.replyAll} onClick={() => update('replyAll', !form.replyAll)}>
                  Reply all
                </FieldToggle>
              )}
              {!showCc && <FieldToggle onClick={() => setShowCc(true)}>Cc</FieldToggle>}
              {!showBcc && <FieldToggle onClick={() => setShowBcc(true)}>Bcc</FieldToggle>}
            </div>
          </HeaderRow>

          {showCc && (
            <HeaderRow label="Cc" error={errors.cc}>
              <input
                value={form.cc}
                onChange={(event) => update('cc', event.target.value)}
                autoComplete="off"
                autoFocus
                aria-label="Cc"
                aria-invalid={Boolean(errors.cc)}
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <RowDismiss label="Remove Cc" onClick={() => { setShowCc(false); update('cc', '') }} />
            </HeaderRow>
          )}

          {showBcc && (
            <HeaderRow label="Bcc" error={errors.bcc}>
              <input
                value={form.bcc}
                onChange={(event) => update('bcc', event.target.value)}
                autoComplete="off"
                autoFocus
                aria-label="Bcc"
                aria-invalid={Boolean(errors.bcc)}
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <RowDismiss label="Remove Bcc" onClick={() => { setShowBcc(false); update('bcc', '') }} />
            </HeaderRow>
          )}

          <HeaderRow label="Subject">
            <input
              value={form.subject}
              onChange={(event) => update('subject', event.target.value)}
              readOnly={mode !== 'compose'}
              placeholder="Subject"
              aria-label="Subject"
              className={cn(
                'placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none',
                mode !== 'compose' && 'text-muted-foreground',
              )}
            />
          </HeaderRow>

          <RichTextEditor
            value={form.bodyHtml}
            onChange={updateBody}
            variant="seamless"
            toolbarPosition="bottom"
            minHeight={mode === 'forward' ? 160 : 240}
            placeholder={mode === 'forward' ? 'Add a note (optional)…' : 'Write your message…'}
          />

          {errors.body && (
            <p role="alert" className="text-destructive border-t px-4 py-2 text-xs">
              {errors.body}
            </p>
          )}

          {mode !== 'compose' && original && (
            <div className="text-muted-foreground border-t px-4 py-2.5 text-xs">
              <span className="text-foreground font-medium">
                {mode === 'reply' ? 'Quoted below your reply' : 'Forwarded content'}
              </span>
              <p className="mt-0.5 line-clamp-2">{original.snippet}</p>
            </div>
          )}

          {attachments.length > 0 && (
            <ul className="space-y-1.5 border-t px-4 py-3">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="bg-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                >
                  <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                  <span className="text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action bar — Send leads, the way every mail client puts it. */}
        <footer className="flex shrink-0 items-center gap-2 border-t px-4 py-3">
          <Button onClick={handleSend} disabled={isPending} className="px-5">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {isPending ? 'Sending…' : 'Send'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_FILES}
            aria-label="Attach files"
            title="Attach files"
          >
            <Paperclip className="size-4" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ''
            }}
          />

          {attachments.length > 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {attachments.length}/{MAX_FILES} · {formatBytes(totalBytes)} of 25 MB
            </span>
          )}

          <span className="text-muted-foreground ml-auto hidden truncate text-xs sm:inline">
            Sends from {connectedEmail}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => !isPending && onClose()}
            aria-label="Discard draft"
            title="Discard draft"
          >
            <Trash2 className="size-4" />
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

/** One header line of the composer: fixed-width label, borderless field, trailing controls. */
function HeaderRow({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('border-b', error && 'bg-destructive/5')}>
      <div className="flex min-h-11 items-center gap-3 px-4">
        <span className="text-muted-foreground w-14 shrink-0 text-xs font-medium">{label}</span>
        {children}
      </div>
      {error && (
        <p role="alert" className="text-destructive px-4 pb-1.5 pl-[4.25rem] text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

function FieldToggle({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function RowDismiss({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-muted-foreground hover:text-foreground shrink-0"
    >
      <X className="size-3.5" />
    </button>
  )
}

function splitAddresses(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** "Ana Silva <ana@example.com>" — shows who the reply is actually addressed to. */
function formatContact(address: EmailAddress): string {
  return address.name ? `${address.name} <${address.email}>` : address.email
}

function prefixed(subject: string, prefix: string): string {
  const clean = subject.trim()
  return clean.toLowerCase().startsWith(prefix.toLowerCase()) ? clean : `${prefix} ${clean}`
}
