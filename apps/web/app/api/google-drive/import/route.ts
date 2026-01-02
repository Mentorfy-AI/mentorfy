import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
}

interface DiscoveryResult {
  totalFiles: number;
  supportedFiles: GoogleDriveFile[];
  skippedFiles: GoogleDriveFile[];
}

/**
 * Force dynamic rendering and disable caching
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Google Drive Import Proxy
 *
 * This route acts as a thin proxy to FastAPI for Google Drive imports.
 * It requires selectedFileIds to be provided (non-empty).
 * For folder discovery without mutations, use /api/google-drive/discover instead.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📥 Google Drive import request received');

    // Check Clerk authentication
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }

    let folderId: string;
    let selectedFileIds: string[] | undefined;
    try {
      const body = await request.json();
      folderId = body.folderId;
      selectedFileIds = body.selectedFileIds;
      console.log('✅ Request parsed:', { folderId, selectedFileIdsCount: selectedFileIds?.length || 0 });
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body. Provide a folderId.' },
        { status: 400 }
      );
    }

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    if (!selectedFileIds || selectedFileIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one file must be selected. Use /api/google-drive/discover to get available files.' },
        { status: 400 }
      );
    }

    console.log('[SECURITY] Google Drive import started', {
      userId,
      organizationId: orgId,
      folderId,
      selectedFileIdsCount: selectedFileIds.length,
      action: 'google_drive_import',
      timestamp: new Date().toISOString()
    });

    // Proxy to FastAPI backend
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/google-drive/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        folder_id: folderId,
        user_id: userId,
        org_id: orgId,
        selected_file_ids: selectedFileIds,
      }),
    });

    const result = await response.json();

    // If auth is required or credentials need refresh, return auth URL
    if (result.error === 'AUTHENTICATION_REQUIRED' || result.error === 'CREDENTIAL_REFRESH_FAILED') {
      console.log('⚠️ Authentication required');
      return NextResponse.json(
        {
          error: result.error,
          message: result.message,
          authUrl: result.auth_url || `${process.env.NEXTJS_URL || 'http://localhost:3000'}/api/google-drive/auth`,
        },
        { status: 401 }
      );
    }

    if (!response.ok) {
      console.error('❌ Import failed:', result);
      return NextResponse.json(result, { status: response.status });
    }

    console.log('✅ Import successful');
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Google Drive import error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to import from Google Drive' },
      { status: 500 }
    );
  }
}

// Note: File discovery, document creation, and upload logic has been moved to FastAPI
// This route is now a thin proxy that delegates to the backend for cleaner separation of concerns
