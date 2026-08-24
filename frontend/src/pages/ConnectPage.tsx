import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Forward,
  Inbox,
  Loader2,
  Lock,
  Mail,
  Reply,
  SendHorizontal,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { startGmailConnect } from '@/api/auth'
import type { SessionBackend } from '@/types/mail'

/** Human-readable versions of the error codes the OAuth callback can redirect with. */
const OAUTH_ERRORS: Record<string, string> = {
  access_denied:
    'Google blocked this account. Either you declined consent, or — far more likely — the address is not on the OAuth consent screen’s Test users list.',
  state_mismatch: 'The authorization response did not match this browser session. Please try again.',
  missing_code: 'Google did not return an authorization code. Please try again.',
  token_exchange_failed: 'Google rejected the authorization code. Check the client ID, secret and redirect URI.',
  profile_unavailable: 'The account was authorized but its email address could not be read.',
  oauth_failed: 'The authorization could not be completed. Check the backend logs for details.',
  insufficient_scope:
    'You signed in, but some permissions were left unticked on Google’s consent screen. MailBridge cannot read or send mail without them, so nothing was connected.',
}

const CAPABILITIES = [
  { icon: Inbox, title: 'Read inbox and sent mail', body: 'Sender, recipients, subject, date, body and attachments.' },
  { icon: SendHorizontal, title: 'Send as the connected account', body: 'Recipients see your Gmail address in the From line.' },
  { icon: Reply, title: 'Reply on the original thread', body: 'Threading headers keep the conversation intact.' },
  { icon: Forward, title: 'Forward with the original quoted', body: 'Standard forwarded-message block, attachments included.' },
]

/** What the consent screen will actually request — stated before the user clicks. */
const SCOPES = [
  'Read, compose and send email on your behalf',
  'Your Gmail address',
  'Your basic profile: name and avatar',
]

interface ConnectPageProps {
  /** Drives the token-handling copy — the two backends make different promises. */
  sessionBackend?: SessionBackend
}

export function ConnectPage({ sessionBackend = 'file' }: ConnectPageProps) {
  const [params, setParams] = useSearchParams()
  const [connecting, setConnecting] = useState(false)
  const errorCode = params.get('error')
  const missingScopes = params.get('missing')

  // Keep the URL clean once the message has been read into the UI.
  useEffect(() => {
    if (!errorCode) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params)
      next.delete('error')
      next.delete('missing')
      setParams(next, { replace: true })
    }, 15_000)
    return () => clearTimeout(timer)
  }, [errorCode, params, setParams])

  const connect = () => {
    setConnecting(true)
    startGmailConnect()
  }

  return (
    <div className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Below lg the panels stack, and the call to action goes first —
          nobody should scroll past the pitch to reach the button. */}
      <BrandPanel />

      <main className="order-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:order-2">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-xl">
              <Mail className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">MailBridge</span>
          </div>

          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Connect your Gmail account</h1>
            <p className="text-muted-foreground text-sm">
              Authorize with Google and MailBridge will read and send mail through the Gmail API as that account.
            </p>
          </header>

          {errorCode && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>
                {errorCode === 'insufficient_scope' ? 'Permissions were not granted' : 'Gmail was not connected'}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{OAUTH_ERRORS[errorCode] ?? `Authorization failed (${errorCode}).`}</p>

                {errorCode === 'insufficient_scope' && (
                  <>
                    {missingScopes && (
                      <p>
                        <span className="font-medium">Missing:</span> {missingScopes}
                      </p>
                    )}
                    <p>
                      Try again and <span className="font-medium">tick every checkbox</span> on the consent screen —
                      or use <span className="font-medium">Select all</span>.
                    </p>
                  </>
                )}

                {errorCode === 'access_denied' && (
                  <p>
                    Add the address under{' '}
                    <span className="font-medium">Google Auth Platform → Audience → Test users</span>, then try again.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button size="lg" className="h-12 w-full text-sm" onClick={connect} disabled={connecting}>
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
            {connecting ? 'Opening Google…' : 'Continue with Google'}
            {!connecting && <ArrowRight className="ml-auto size-4 opacity-60" />}
          </Button>

          <section className="space-y-2.5">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              MailBridge will ask for
            </h2>
            <ul className="space-y-2">
              {SCOPES.map((scope) => (
                <li key={scope} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span>{scope}</span>
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          <div className="text-muted-foreground space-y-2.5 text-xs">
            <p className="flex items-start gap-2.5">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {sessionBackend === 'cookie'
                ? 'Tokens are AES-256-GCM encrypted into an httpOnly cookie — opaque to page scripts, and a tampered value is rejected outright.'
                : 'Access and refresh tokens are stored on the backend only — the browser never receives them.'}
            </p>
            <p className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Revoke at any time from the Connected Gmail panel, or from your Google Account settings.
            </p>
          </div>

          <Alert>
            <TriangleAlert />
            <AlertTitle>Demo project — test users only</AlertTitle>
            <AlertDescription>
              The OAuth consent screen is unverified, so only addresses added under{' '}
              <span className="text-foreground font-medium">Google Auth Platform → Audience → Test users</span> can
              connect. Any other account is refused with{' '}
              <code className="font-mono text-[11px]">Error 403: access_denied</code>.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    </div>
  )
}

/** Brand side of the split. Collapses to a compact banner on small screens. */
function BrandPanel() {
  return (
    <aside className="bg-muted/50 relative order-2 flex flex-col justify-between overflow-hidden border-t px-5 py-10 sm:px-10 lg:order-1 lg:border-t-0 lg:border-r lg:py-12">
      {/* Faint grid, kept behind the content and out of the accessibility tree. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="relative hidden items-center gap-2.5 lg:flex">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
          <Mail className="size-4.5" />
        </div>
        <span className="text-base font-semibold tracking-tight">MailBridge</span>
      </div>

      <div className="relative max-w-md lg:mt-0">
        <h2 className="text-xl font-semibold tracking-tight text-balance lg:text-3xl">
          Gmail integration, demonstrated end to end.
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          A reference implementation of Google OAuth 2.0 and the Gmail API — the same flow you would lift into a
          production application.
        </p>

        <ul className="mt-7 space-y-4">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <div className="bg-background text-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
                <Icon className="size-4" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-muted-foreground relative mt-8 text-xs lg:mt-0">
        OAuth 2.0 · Gmail API · No third-party SMTP
      </p>
    </aside>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.18 15.23 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}
