import express, { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { sniffImage, storage, UPLOAD_DIR } from '../../lib/storage';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';

const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

export const uploadsRouter = Router();

/**
 * Upload a listing / profile image. Only members of a business may upload
 * (customers don't need images yet), only real JPEG/PNG/WebP content is accepted,
 * files get random names, and the original filename is discarded.
 */
uploadsRouter.post('/uploads/images', requireAuth, uploadLimiter, async (req, res, next) => {
  const member = await prisma.organizationMember.findFirst({ where: { userId: req.auth!.userId }, select: { id: true } });
  if (!member) return next(AppError.forbidden('Only business accounts can upload images'));

  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        const tooBig = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
        throw AppError.badRequest(tooBig ? 'Images must be 5 MB or smaller' : 'Upload failed');
      }
      if (!req.file) throw AppError.badRequest('Attach an image in the "file" field');
      const kind = sniffImage(req.file.buffer);
      if (!kind) throw AppError.badRequest('Only JPEG, PNG or WebP images are allowed');
      const stored = await storage.put(req.file.buffer, kind.ext, kind.contentType);
      ok(res, { url: stored.url }, 201);
    } catch (e) {
      next(e);
    }
  });
});

/** Static serving for the local-disk driver. Images only, never executed or sniffed as HTML. */
export const uploadsStatic = express.static(UPLOAD_DIR, {
  index: false,
  dotfiles: 'deny',
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
});
