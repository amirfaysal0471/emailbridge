/** Error type carrying an HTTP status so controllers can throw and forget. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static unauthorized(message = 'No Gmail account is connected.') {
    return new ApiError(401, 'GMAIL_NOT_CONNECTED', message)
  }

  static forbidden(message: string) {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message: string) {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static upstream(message: string, details?: unknown) {
    return new ApiError(502, 'GMAIL_API_ERROR', message, details)
  }
}
