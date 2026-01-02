import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check super admin status
    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
      console.log('[SECURITY] Unauthorized avatar upload attempt', {
        userId,
        action: 'upload_avatar',
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const botId = formData.get('botId') as string;

    if (!file || !botId) {
      return NextResponse.json(
        { error: 'Missing file or botId' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 5MB` },
        { status: 400 }
      );
    }

    // Get file extension
    const ext = file.name.split('.').pop();
    if (!ext) {
      return NextResponse.json(
        { error: 'File must have a valid extension' },
        { status: 400 }
      );
    }

    const fileName = `${botId}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage (overwrites existing file)
    const supabase = createServiceClient();
    const { data, error: uploadError } = await supabase.storage
      .from('mentor-bot-avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('[AVATAR_UPLOAD] Upload failed', {
        userId,
        botId,
        error: uploadError,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { error: 'Failed to upload avatar' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('mentor-bot-avatars')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    console.log('[AVATAR_UPLOAD] Success', {
      userId,
      botId,
      fileName,
      publicUrl,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      publicUrl,
      fileName
    });

  } catch (error) {
    console.error('[AVATAR_UPLOAD] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}
