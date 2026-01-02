import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeGraph, checkGraphitiHealth } from '@/lib/graphiti-client';

export interface SearchResponse {
  results?: Array<{
    fact: string;
    confidence?: number;
    source?: string;
  }>;
  query?: string;
  count?: number;
  health?: boolean;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limitParam = searchParams.get('limit');
    const healthCheck = searchParams.get('health') === 'true';

    // Health check endpoint
    if (healthCheck) {
      const health = await checkGraphitiHealth();
      return NextResponse.json({ health });
    }

    // Validate query parameter
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Parse limit parameter
    const limit = limitParam ? parseInt(limitParam, 10) : 5;
    if (isNaN(limit) || limit < 1 || limit > 20) {
      return NextResponse.json(
        { error: 'Limit must be a number between 1 and 20' },
        { status: 400 }
      );
    }

    console.log(`Debug search: "${query}" (limit: ${limit})`);

    // Search the knowledge graph
    const results = await searchKnowledgeGraph(query, limit);

    return NextResponse.json({
      results,
      query,
      count: results.length
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Search failed' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  try {
    const body = await request.json();
    const { query, limit = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 20) {
      return NextResponse.json(
        { error: 'Limit must be a number between 1 and 20' },
        { status: 400 }
      );
    }

    console.log(`Debug search (POST): "${query}" (limit: ${limit})`);

    // Search the knowledge graph
    const results = await searchKnowledgeGraph(query, limit);

    return NextResponse.json({
      results,
      query,
      count: results.length
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Search failed' 
      },
      { status: 500 }
    );
  }
}