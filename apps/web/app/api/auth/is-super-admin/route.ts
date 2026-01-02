import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const superAdmin = await isSuperAdmin()
    return NextResponse.json({ isSuperAdmin: superAdmin })
  } catch (error) {
    return NextResponse.json({ isSuperAdmin: false }, { status: 200 })
  }
}
