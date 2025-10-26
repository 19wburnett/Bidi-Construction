import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/send-analysis-notification - Send email notification when analysis is completed
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, type, userEmail } = body

    if (!planId || !type || !userEmail) {
      return NextResponse.json({ 
        error: 'Missing required fields: planId, type, userEmail' 
      }, { status: 400 })
    }

    // Verify user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('title, file_name, project_name')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, just log the notification
    console.log(`Analysis notification for ${type} analysis completed:`, {
      planId,
      planTitle: plan.title || plan.file_name,
      projectName: plan.project_name,
      userEmail,
      completedBy: user.email,
      timestamp: new Date().toISOString()
    })

    // In a real implementation, you would send an email here:
    // await sendEmail({
    //   to: userEmail,
    //   subject: `${type === 'takeoff' ? 'Takeoff' : 'Quality'} Analysis Complete`,
    //   template: 'analysis-complete',
    //   data: {
    //     planTitle: plan.title || plan.file_name,
    //     projectName: plan.project_name,
    //     analysisType: type,
    //     dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/plans/${planId}`
    //   }
    // })

    return NextResponse.json({ 
      success: true, 
      message: 'Notification logged successfully' 
    })

  } catch (error) {
    console.error('Error sending analysis notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}