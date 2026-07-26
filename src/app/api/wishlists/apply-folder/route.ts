/**
 * POST /api/wishlists/apply-folder
 *
 * Bulk-assigns imported items to a folder (category).
 * Creates the folder if it doesn't exist, or uses an existing one.
 * Supports subfolders.
 *
 * Input: { wishlistId, itemIds, folderName, subfolders?, useExistingFolderId? }
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderManager } from '@/lib/providers';
import { FolderSuggestionService, type ApplyFolderInput } from '@/lib/services/folder-suggestion';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    wishlistId?: string;
    itemIds?: string[];
    folderName?: string;
    subfolders?: { name: string; itemIds: string[] }[];
    useExistingFolderId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { wishlistId, itemIds, folderName, subfolders, useExistingFolderId } = body;

  if (!wishlistId || !itemIds || itemIds.length === 0) {
    return NextResponse.json({ error: 'wishlistId and itemIds are required.' }, { status: 400 });
  }

  if (!folderName && !useExistingFolderId) {
    return NextResponse.json(
      { error: 'Either folderName or useExistingFolderId is required.' },
      { status: 400 }
    );
  }

  const input: ApplyFolderInput = {
    wishlistId,
    itemIds,
    folderName: folderName || '',
    subfolders,
    useExistingFolderId,
  };

  try {
    const providers = getProviderManager();
    const service = new FolderSuggestionService(providers);
    await service.applyFolder(input, user.id);

    revalidatePath(`/wishlists/${wishlistId}`);
    revalidatePath('/dashboard');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to apply folder.' },
      { status: 500 }
    );
  }
}
