import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';

/**
 * File storage behind a tiny interface so the local-disk driver used in
 * development can be swapped for S3-compatible object storage in production
 * without touching callers.
 */
export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageDriver {
  put(buffer: Buffer, ext: string, contentType: string): Promise<StoredFile>;
}

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

class LocalDiskStorage implements StorageDriver {
  async put(buffer: Buffer, ext: string): Promise<StoredFile> {
    const now = new Date();
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const key = `${folder}/${randomUUID()}.${ext}`;
    await mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, key), buffer, { flag: 'wx' });
    return { key, url: `${env.PUBLIC_API_ORIGIN}/uploads/${key}` };
  }
}

export const storage: StorageDriver = new LocalDiskStorage();

/** Identify an image by its magic bytes — never trust the filename or client MIME type. */
export function sniffImage(buf: Buffer): { ext: 'jpg' | 'png' | 'webp'; contentType: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  return null;
}
