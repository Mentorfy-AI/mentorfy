export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

interface DiscoverRequest {
  folderId: string
}

/**
 * POST /api/google-drive/discover
 * Proxy endpoint for discovering Google Drive folder structure (read-only, no mutations)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 })
    }

    let folderId: string
    try {
      const body: DiscoverRequest = await request.json()
      folderId = body.folderId
      console.log('✅ Discover request parsed:', { folderId })
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body. Provide a folderId.' },
        { status: 400 }
      )
    }

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      )
    }

    console.log('[SECURITY] Google Drive discovery started', {
      userId,
      organizationId: orgId,
      folderId,
      action: 'google_drive_discover',
      timestamp: new Date().toISOString()
    })

    // Proxy to FastAPI backend
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/google-drive/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        folder_id: folderId,
        user_id: userId,
        org_id: orgId,
      }),
    })

    const result = await response.json()

    // If auth is required or credentials need refresh, return auth URL
    if (result.error === 'AUTHENTICATION_REQUIRED' || result.error === 'CREDENTIAL_REFRESH_FAILED') {
      console.log('⚠️ Google Drive auth required')
      return NextResponse.json(result, { status: 401 })
    }

    if (!response.ok) {
      console.error('❌ Backend error:', result.error)
      return NextResponse.json(
        result,
        { status: response.status }
      )
    }

    console.log('✅ Discovery successful')
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('❌ Discover route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
