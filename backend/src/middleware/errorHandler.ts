import type { NextFunction, Request, Response } from 'express'
import { isProduction } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    ApiError.notFound(
      `No route matches ${req.method} ${req.originalUrl}. See / for the list of available endpoints.`,
    ),
  )
}

/** Single place where every failure becomes a predictable JSON envelope. */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected server error.')

  if (apiError.status >= 500) {
    console.error('[error]', error)
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && !isProduction ? { details: apiError.details } : {}),
    },
  })
}
