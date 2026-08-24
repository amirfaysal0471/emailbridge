import { useEffect } from 'react'

export interface ShortcutMap {
  [key: string]: (() => void) | undefined
}

/** True when focus is somewhere the user is typing, so shortcuts must stay quiet. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Global single-key shortcuts, Gmail-style.
 *
 * Modifier combinations are ignored so browser and OS shortcuts keep working,
 * and nothing fires while a field has focus. Callers pass `enabled: false`
 * while a dialog is open — the dialog owns the keyboard then, including Escape.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const handler = shortcuts[event.key.toLowerCase()]
      if (!handler) return

      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, enabled])
}
