/**
 * GET /uploads/[...path]
 *
 * Serves uploaded files from the persistent uploads directory.
 *
 * Security:
 * - Authentication required. Uploaded images belong to a private collection,
 *   so anonymous callers get the same 404 as a missing file.
 * - Authorisation: the Media row must belong to the caller (admins may review
 *   any file). A file that exists on disk without a Media row is never served.
 * - Path traversal prevention via `resolveUploadPath`, which compares resolved
 *   paths with `path.relative` (works on Windows and POSIX) instead of string
 *   prefixing.
 * - Responses are private and non-scriptable.
 *
 * Caching:
 * - `private` because the response is per-user; filenames are unique so the
 *   browser can still cache within the session.
 */

import { constants } from 'fs';
import { open } from 'fs/promises';
import { join } from 'path';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveUploadPath } from '@/lib/uploads/path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

/** Map file extensions to MIME types. SVG is intentionally absent. */
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

function getMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) return 'application/octet-stream';
  return MIME_TYPES[filename.slice(dotIndex).toLowerCase()] ?? 'application/octet-stream';
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return notFound();

  const { path: segments } = await params;
  const resolvedPath = resolveUploadPath(UPLOAD_DIR, segments);

  if (!resolvedPath.ok) {
    return new Response('Forbidden', { status: 403 });
  }

  // Only files registered as Media — and owned by this user — are readable.
  // Media.storagePath uses forward slashes; resolveUploadPath normalises to it.
  const media = await prisma.media.findFirst({
    where: { storagePath: resolvedPath.relativePath },
    select: { uploadedById: true },
  });

  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';

  if (!media || (media.uploadedById !== user.id && !isAdmin)) {
    return notFound();
  }

  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    // Open once and use that descriptor for both the metadata check and the
    // read. Checking a path with stat() and then reopening it allows the file
    // (or a symlink) to be swapped between the two operations.
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
    handle = await open(resolvedPath.absolutePath, flags);
    const fileStat = await handle.stat();
    if (!fileStat.isFile()) return notFound();

    const fileBuffer = await handle.readFile();

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(resolvedPath.absolutePath),
        'Content-Length': String(fileStat.size),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Uploads: failed to read file', {
        storagePath: resolvedPath.relativePath,
        code: (error as NodeJS.ErrnoException).code,
      });
    }
    return notFound();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
