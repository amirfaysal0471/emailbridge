import 'dotenv/config'
import { z } from 'zod'

/**
 * Every environment variable the backend needs is declared and validated here.
 * The process refuses to boot with an invalid configuration, so a misconfigured
 * OAuth client fails loudly at startup instead of halfway through a login.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.url('GOOGLE_REDIRECT_URI must be a valid URL'),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),

  FRONTEND_URL: z.url().default('http://localhost:5173'),
  TOKEN_STORE_PATH: z.string().default('./data/accounts.json'),

  /**
   * Where the connected account is kept between requests.
   * 'auto' picks 'cookie' on serverless hosts and 'file' everywhere else.
   */
  SESSION_BACKEND: z.enum(['auto', 'file', 'cookie']).default('auto'),

  /**
   * Set when the API and the React app are served from the same origin — then
   * the OAuth callback can redirect to a path instead of an absolute URL, and
   * the session cookie works without cross-site relaxations.
   */
  SAME_ORIGIN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  console.error(`\nInvalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
