import type { ErrorRequestHandler, RequestHandler } from 'express';
import { SizingInputError } from '@solaris/solar-engine';
import { z } from '@solaris/validation';
import { isProduction } from '../config/env';
import { logger } from '../lib/logger';
import { AppError } from '../shared/errors';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof SizingInputError) {
    return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE_INPUT', message: err.message } });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Body-parser errors (malformed JSON, payload too large)
  if (typeof err === 'object' && err !== null && 'status' in err && 'type' in err) {
    const status = Number((err as { status: number }).status) || 400;
    return res.status(status).json({ success: false, error: { code: 'BAD_REQUEST', message: (err as Error).message } });
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: isProduction ? 'Something went wrong' : String((err as Error)?.message ?? err) },
  });
};
