import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { buildEmailDocument, plainTextToHtml, sanitizeEmailHtml } from '@/lib/sanitize'
import type { MessageDetail } from '@/types/mail'

const MIN_HEIGHT = 96

/**
 * Renders an email body inside a sandboxed iframe.
 *
 * The sandbox deliberately omits `allow-scripts`, so no JavaScript can run in
 * the frame at all — belt and braces alongside the DOMPurify pass. Because
 * scripts are dead, granting `allow-same-origin` is safe and buys us something
 * we need: the parent can read the document to size the frame to its content.
 */
export function MessageBody({ message }: { message: MessageDetail }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const { resolvedTheme } = useTheme()

  const srcDoc = useMemo(() => {
    const html = message.bodyHtml
      ? sanitizeEmailHtml(message.bodyHtml)
      : plainTextToHtml(message.bodyText || message.snippet || '(This message has no text content.)')

    return buildEmailDocument(html, resolvedTheme === 'dark' ? 'dark' : 'light')
  }, [message.bodyHtml, message.bodyText, message.snippet, resolvedTheme])

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc?.documentElement) return
    setHeight(Math.max(MIN_HEIGHT, Math.ceil(doc.documentElement.scrollHeight)))
  }, [])

  // Remote images and web fonts land after load, so keep watching for a while.
  useEffect(() => {
    setHeight(MIN_HEIGHT)
    const frame = frameRef.current
    if (!frame) return

    let observer: ResizeObserver | undefined
    const attach = () => {
      measure()
      const body = frame.contentDocument?.body
      if (body && 'ResizeObserver' in window) {
        observer = new ResizeObserver(measure)
        observer.observe(body)
      }
    }

    attach()
    frame.addEventListener('load', attach)
    return () => {
      frame.removeEventListener('load', attach)
      observer?.disconnect()
    }
  }, [srcDoc, measure])

  return (
    <iframe
      ref={frameRef}
      title={`Email body: ${message.subject}`}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      onLoad={measure}
      className="w-full border-0 bg-transparent"
      style={{ height }}
    />
  )
}
