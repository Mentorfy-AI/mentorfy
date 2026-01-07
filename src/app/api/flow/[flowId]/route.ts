import { NextResponse } from 'next/server'
import { getFlow } from '@/data/flows'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const flow = getFlow(flowId)
    return NextResponse.json(flow)
  } catch (err) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 })
  }
}
