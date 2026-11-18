import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveUploadPath } from '@/lib/uploads/path';

/**
 * The previous implementation compared `resolvedFile.startsWith(dir + '/')`,
 * which is always false on Windows because `path.resolve` returns backslashes.
 * These cases pass on both POSIX and Windows runners.
 */
describe('resolveUploadPath', () => {
  const uploadDir = resolve('/tmp', 'derlist-uploads');

  it('resolves a normal nested file inside the upload directory', () => {
    const result = resolveUploadPath(uploadDir, ['products', 'photo.png']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.relativePath).toBe('products/photo.png');
    expect(result.absolutePath).toBe(join(uploadDir, 'products', 'photo.png'));
  });

  it('accepts a flat filename in the upload root', () => {
    const result = resolveUploadPath(uploadDir, ['avatar.png']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.relativePath).toBe('avatar.png');
  });

  it('rejects traversal or absolute input', () => {
    const cases: string[][] = [
      ['..', 'package.json'],
      ['products', '..', '..', 'secret'],
      ['products/../../secret'],
      ['..\\secret'],
      ['C:\\Windows\\win.ini'],
      ['/etc/passwd'],
      [''],
      [],
    ];

    for (const segments of cases) {
      const result = resolveUploadPath(uploadDir, segments);
      expect(result.ok, `expected rejection for ${JSON.stringify(segments)}`).toBe(false);
    }
  });

  it('rejects encoded traversal sequences', () => {
    const result = resolveUploadPath(uploadDir, ['products', '%2e%2e%2fsecret']);
    expect(result.ok).toBe(false);
  });

  it('keeps a path that merely contains dots in the name', () => {
    const result = resolveUploadPath(uploadDir, ['image.v2.png']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.relativePath).toBe('image.v2.png');
  });
});
