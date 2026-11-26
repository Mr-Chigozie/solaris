import type { NextFunction, Request, Response } from 'express';
import type { z } from '@solaris/validation';

/**
 * Validate and replace `req.body` (or a copy of `req.query`) with the parsed value.
 * Failures become a 400 with field-level issues via the error handler.
 */
export function validateBody<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function parseQuery<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  return schema.parse(req.query);
}
