import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Test database connection
    const { data, error } = await supabase
      .from('users')
      .select('id, email, subscription_status')
      .limit(5)

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error 
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook endpoint is accessible',
      databaseConnection: 'OK',
      userCount: data?.length || 0,
      users: data
    })
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: 'Test failed',
      details: err 
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test webhook received',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: 'Test webhook failed',
      details: err 
    })
  }
}
