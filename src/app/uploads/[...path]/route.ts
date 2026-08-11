/**
 * GET /uploads/[...path]
 *
 * Serves uploaded files from the persistent /app/uploads directory.
 * This route makes the Docker named volume accessible via HTTP without
 * placing uploads inside /public (which is baked into the image).
 *
 * Security:
 * - Path traversal prevention (rejects .., encoded variants, absolute paths)
 * - Only serves files from within UPLOAD_DIR
 * - No authentication required (avatars/images must be publicly viewable)
 *
 * Caching:
 * - Immutable cache headers (uploaded files use unique random filenames)
 */

import { readFile, stat } from 'fs/promises';
import { join, resolve, normalize } from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

/** Map file extensions to MIME types. */
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
};

function getMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) return 'application/octet-stream';
  const ext = filename.slice(dotIndex).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  // Reject empty paths
  if (!segments || segments.length === 0) {
    return new Response('Not Found', { status: 404 });
  }

  // Reconstruct the relative path from segments
  const relativePath = segments.join('/');

  // ── Path traversal protection ──
  // Reject any segment containing ".." or that is absolute
  for (const segment of segments) {
    if (
      segment === '..' ||
      segment === '.' ||
      segment.includes('..') ||
      segment.startsWith('/') ||
      segment.includes('\0')
    ) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Decode and re-check (catches %2e%2e and similar encodings)
  const decoded = decodeURIComponent(relativePath);
  if (decoded.includes('..') || decoded.startsWith('/')) {
    return new Response('Forbidden', { status: 403 });
  }

  // Resolve the full filesystem path and verify it's within UPLOAD_DIR
  const resolvedUploadDir = resolve(UPLOAD_DIR);
  const fullPath = resolve(resolvedUploadDir, normalize(decoded));

  if (!fullPath.startsWith(resolvedUploadDir + '/')) {
    return new Response('Forbidden', { status: 403 });
  }

  // ── Serve the file ──
  try {
    const fileStat = await stat(fullPath);

    if (!fileStat.isFile()) {
      return new Response('Not Found', { status: 404 });
    }

    const fileBuffer = await readFile(fullPath);
    const mimeType = getMimeType(fullPath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileStat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    // File doesn't exist or can't be read
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return new Response('Not Found', { status: 404 });
    }
    return new Response('Not Found', { status: 404 });
  }
}
