import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { userId, status = 'active' } = await request.json()

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId is required' 
      })
    }

    const supabase = createServerClient()
    
    // Manually update subscription status
    const { data, error } = await supabase
      .from('users')
      .update({ 
        subscription_status: status,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error 
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Subscription status updated to ${status}`,
      user: data?.[0]
    })
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: 'Manual update failed',
      details: err 
    })
  }
}
