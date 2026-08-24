import { useCallback, useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import {
  Bold,
  Code,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface RichTextValue {
  html: string
  text: string
}

interface RichTextEditorProps {
  value: string
  onChange: (value: RichTextValue) => void
  placeholder?: string
  minHeight?: number
  invalid?: boolean
  ariaLabelledBy?: string
  /** 'top' frames the editor as a field; 'bottom' matches an email composer's footer toolbar. */
  toolbarPosition?: 'top' | 'bottom'
  /** Seamless drops the border so the editor can sit flush inside a composer surface. */
  variant?: 'bordered' | 'seamless'
}

/**
 * Compose body editor.
 *
 * Emits both HTML and plain text on every change: the HTML becomes the
 * message's `text/html` part and the text becomes the `text/plain` alternative,
 * so recipients on either kind of client see something sensible.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your message…',
  minHeight = 200,
  invalid = false,
  ariaLabelledBy,
  toolbarPosition = 'top',
  variant = 'bordered',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // email bodies rarely need headings, and they render inconsistently
        horizontalRule: false,
        codeBlock: { HTMLAttributes: { class: 'rounded-md bg-muted p-2 text-xs' } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose-email focus:outline-none',
        ...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange({ html: instance.getHTML(), text: instance.getText() })
    },
  })

  // Reset when the dialog reopens with a different draft.
  useEffect(() => {
    if (!editor) return
    if (value === editor.getHTML()) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [value, editor])

  if (!editor) {
    return (
      <div
        className={cn('bg-muted/40 animate-pulse', variant === 'bordered' && 'rounded-lg border')}
        style={{ height: minHeight }}
      />
    )
  }

  const content = (
    <EditorContent
      editor={editor}
      className={cn(
        'overflow-y-auto text-sm',
        variant === 'bordered' ? 'max-h-[40dvh] px-3 py-2.5' : 'flex-1 px-4 py-3',
      )}
      style={{ minHeight }}
    />
  )

  const toolbar = <Toolbar editor={editor} position={toolbarPosition} />

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        variant === 'bordered' &&
          'focus-within:border-ring focus-within:ring-ring/20 overflow-hidden rounded-lg border transition-colors focus-within:ring-[3px]',
        variant === 'bordered' && invalid && 'border-destructive ring-destructive/15 ring-[3px]',
      )}
    >
      {toolbarPosition === 'top' ? (
        <>
          {toolbar}
          {content}
        </>
      ) : (
        <>
          {content}
          {toolbar}
        </>
      )}
    </div>
  )
}

/** Keeps the editor's selection intact when a toolbar control is pressed. */
const keepSelection = (event: React.MouseEvent) => event.preventDefault()

function Toolbar({ editor, position }: { editor: Editor; position: 'top' | 'bottom' }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-0.5 px-1.5 py-1',
        position === 'top' ? 'bg-muted/40 border-b' : 'border-t',
      )}
    >
      <MarkButton editor={editor} mark="bold" label="Bold" icon={<Bold className="size-3.5" />} />
      <MarkButton editor={editor} mark="italic" label="Italic" icon={<Italic className="size-3.5" />} />
      <MarkButton editor={editor} mark="underline" label="Underline" icon={<UnderlineIcon className="size-3.5" />} />
      <MarkButton editor={editor} mark="strike" label="Strikethrough" icon={<Strikethrough className="size-3.5" />} />

      <Separator orientation="vertical" className="mx-1 h-5" />

      <NodeButton editor={editor} node="bulletList" label="Bullet list" icon={<List className="size-3.5" />} />
      <NodeButton
        editor={editor}
        node="orderedList"
        label="Numbered list"
        icon={<ListOrdered className="size-3.5" />}
      />
      <NodeButton editor={editor} node="blockquote" label="Quote" icon={<Quote className="size-3.5" />} />
      <MarkButton editor={editor} mark="code" label="Inline code" icon={<Code className="size-3.5" />} />

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Toggle
        size="sm"
        pressed={editor.isActive('link')}
        onPressedChange={setLink}
        onMouseDown={keepSelection}
        aria-label="Add link"
      >
        <Link2 className="size-3.5" />
      </Toggle>
      {editor.isActive('link') && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          aria-label="Remove link"
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off className="size-3.5" />
        </Button>
      )}

      <div className="ml-auto flex gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          aria-label="Undo"
          onMouseDown={keepSelection}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          aria-label="Redo"
          onMouseDown={keepSelection}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function MarkButton({
  editor,
  mark,
  label,
  icon,
}: {
  editor: Editor
  mark: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive(mark)}
      onPressedChange={() => editor.chain().focus().toggleMark(mark).run()}
      onMouseDown={keepSelection}
      aria-label={label}
      title={label}
    >
      {icon}
    </Toggle>
  )
}

function NodeButton({
  editor,
  node,
  label,
  icon,
}: {
  editor: Editor
  node: 'bulletList' | 'orderedList' | 'blockquote'
  label: string
  icon: React.ReactNode
}) {
  const toggle = () => {
    const chain = editor.chain().focus()
    if (node === 'bulletList') chain.toggleBulletList().run()
    else if (node === 'orderedList') chain.toggleOrderedList().run()
    else chain.toggleBlockquote().run()
  }

  return (
    <Toggle
      size="sm"
      pressed={editor.isActive(node)}
      onPressedChange={toggle}
      onMouseDown={keepSelection}
      aria-label={label}
      title={label}
    >
      {icon}
    </Toggle>
  )
}
