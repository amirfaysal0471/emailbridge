import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SHORTCUTS = [
  { keys: ['c'], description: 'Compose a new message' },
  { keys: ['g', 'then', 'i'], description: 'Go to Inbox' },
  { keys: ['g', 'then', 's'], description: 'Go to Sent' },
  { keys: ['/'], description: 'Focus the search box' },
  { keys: ['r'], description: 'Refresh the current mailbox' },
  { keys: ['?'], description: 'Show this help' },
  { keys: ['Esc'], description: 'Close the reading pane' },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Single keys, active whenever you are not typing in a field.</DialogDescription>
        </DialogHeader>

        <dl className="divide-border divide-y text-sm">
          {SHORTCUTS.map(({ keys, description }) => (
            <div key={description} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{description}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {keys.map((key, index) =>
                  key === 'then' ? (
                    <span key={index} className="text-muted-foreground text-xs">
                      then
                    </span>
                  ) : (
                    <kbd
                      key={index}
                      className="bg-muted rounded border px-1.5 py-0.5 font-mono text-xs font-medium shadow-sm"
                    >
                      {key}
                    </kbd>
                  ),
                )}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
