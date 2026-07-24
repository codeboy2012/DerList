/**
 * File Upload Service — storage abstraction.
 *
 * Stores files on local disk by default. The storage backend can be
 * swapped to S3, Cloudflare R2, or Backblaze B2 by implementing the
 * StorageBackend interface without changing application code.
 */

import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Storage Backend Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageBackend {
  /** Save a file and return the storage path. */
  save(buffer: Buffer, filename: string, directory: string): Promise<string>;
  /** Delete a file by its storage path. */
  delete(storagePath: string): Promise<void>;
  /** Get the public URL for a stored file. */
  getUrl(storagePath: string): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Disk Storage (default)
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

class LocalStorage implements StorageBackend {
  async save(buffer: Buffer, filename: string, directory: string): Promise<string> {
    const dir = join(UPLOAD_DIR, directory);
    await mkdir(dir, { recursive: true });
    const path = join(dir, filename);
    await writeFile(path, buffer);
    return `${directory}/${filename}`;
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const fullPath = join(UPLOAD_DIR, storagePath);
      await unlink(fullPath);
    } catch {
      // File may already be deleted
    }
  }

  getUrl(storagePath: string): string {
    return `/uploads/${storagePath}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let _storage: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (!_storage) {
    // Future: check env for S3/R2 config and instantiate appropriate backend
    _storage = new LocalStorage();
  }
  return _storage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface UploadResult {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url: string;
}

export interface UploadError {
  error: string;
}

/**
 * Process and store an uploaded file.
 *
 * @param file The uploaded File object from FormData.
 * @param directory Subdirectory to store in (e.g. "avatars", "wishlist-icons", "products").
 * @returns Upload result with paths, or an error.
 */
export async function uploadFile(
  file: File,
  directory: string,
): Promise<UploadResult | UploadError> {
  // Validate type
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WEBP, GIF, SVG.` };
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    return { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB.` };
  }

  // Generate unique filename
  const ext = getExtension(file.name, file.type);
  const uniqueId = randomBytes(16).toString('hex');
  const filename = `${uniqueId}${ext}`;

  // Read file to buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Store
  const storage = getStorage();
  const storagePath = await storage.save(buffer, filename, directory);
  const url = storage.getUrl(storagePath);

  return {
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    storagePath,
    url,
  };
}

/**
 * Delete an uploaded file.
 */
export async function deleteUpload(storagePath: string): Promise<void> {
  const storage = getStorage();
  await storage.delete(storagePath);
}

/**
 * Get the public URL for an upload.
 */
export function getUploadUrl(storagePath: string): string {
  const storage = getStorage();
  return storage.getUrl(storagePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getExtension(filename: string, mimeType: string): string {
  // Try from filename
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex > 0) return filename.slice(dotIndex).toLowerCase();

  // Fallback from mime
  const mimeExtMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  return mimeExtMap[mimeType] ?? '.bin';
}
