import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/tools`);

    if (!response.ok) {
      const error = await response.text();
      console.warn(`Backend API returned error: ${response.status} - ${error}`);
      // Return empty array if backend is unavailable
      return NextResponse.json([]);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn('Backend API not available, returning empty tools list:', error instanceof Error ? error.message : error);
    // Return empty array if backend is not running
    return NextResponse.json([]);
  }
}