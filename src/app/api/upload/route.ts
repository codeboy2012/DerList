import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/uploads';

/**
 * POST /api/upload
 *
 * Upload a file. Requires authentication.
 * Accepts multipart/form-data with:
 * - file: the file to upload
 * - purpose: string context (e.g. "avatar", "wishlist_icon", "product_image")
 */
export async function POST(request: Request) {
  const user = await requireUser();

  const formData = await request.formData();
  const file = formData.get('file');
  const purpose = (formData.get('purpose') as string) ?? 'general';

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'No file provided.' }, { status: 400 });
  }

  // Determine storage directory from purpose
  const dirMap: Record<string, string> = {
    avatar: 'avatars',
    wishlist_icon: 'wishlist-icons',
    product_image: 'products',
    general: 'misc',
  };
  const directory = dirMap[purpose] ?? 'misc';

  const result = await uploadFile(file, directory);

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Save to Media table
  const media = await prisma.media.create({
    data: {
      originalName: result.originalName,
      filename: result.filename,
      mimeType: result.mimeType,
      size: result.size,
      storagePath: result.storagePath,
      uploadedById: user.id,
      purpose,
    },
  });

  return Response.json({
    id: media.id,
    url: result.url,
    filename: result.filename,
    mimeType: result.mimeType,
    size: result.size,
  });
}
