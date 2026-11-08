import { describe, expect, it } from 'vitest';
import { uploadFile } from '@/lib/uploads';

describe('uploadFile content type policy', () => {
  it('rejects SVG uploads (stored XSS vector)', async () => {
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      'x.svg',
      {
        type: 'image/svg+xml',
      }
    );

    const result = await uploadFile(file, 'misc');

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/unsupported file type/i);
      // The allowlist message must not advertise SVG as accepted.
      expect(result.error).toMatch(/Allowed: JPG, PNG, WEBP, GIF\./);
    }
  });

  it('rejects executable and HTML content types', async () => {
    for (const type of ['text/html', 'application/javascript', 'application/xhtml+xml']) {
      const file = new File(['x'], 'x.bin', { type });
      const result = await uploadFile(file, 'misc');
      expect('error' in result, type).toBe(true);
    }
  });
});
