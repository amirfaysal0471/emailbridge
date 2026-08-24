import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { ApiError } from '../utils/ApiError.js'

/** Replaces req.body with the parsed value so controllers get typed input. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      next(ApiError.badRequest('Request body failed validation.', result.error.issues))
      return
    }
    req.body = result.data
    next()
  }
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      next(ApiError.badRequest('Query parameters failed validation.', result.error.issues))
      return
    }
    // Express 5 exposes req.query as a getter, so the parsed value rides along on res.locals.
    res.locals.query = result.data
    next()
  }
}
