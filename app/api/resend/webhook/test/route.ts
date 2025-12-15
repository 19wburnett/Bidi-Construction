import { NextRequest, NextResponse } from 'next/server'

// Public endpoint - no auth required for testing
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Test endpoint to verify webhook connectivity
 * This helps diagnose if webhooks are reaching the server
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Webhook test endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: request.nextUrl.toString(),
    host: request.headers.get('host'),
    method: 'GET'
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({
      message: 'Test webhook received',
      body,
      timestamp: new Date().toISOString(),
      url: request.nextUrl.toString(),
      host: request.headers.get('host'),
      method: 'POST'
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to parse body',
      message: error.message 
    }, { status: 400 })
  }
}
