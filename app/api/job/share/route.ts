import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

// POST /api/job/share - Create a shareable link for a job (all plans)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      jobId, 
      expiresInDays = 30
    } = body

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Verify user can access this job
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if a share already exists for this job
    const { data: existingShare, error: checkError } = await supabase
      .from('job_shares')
      .select('*')
      .eq('job_id', jobId)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing share:', checkError)
    }

    // If we found an existing non-expired share, use it
    if (existingShare) {
      const isExpired = existingShare.expires_at ? new Date(existingShare.expires_at) < new Date() : false
      
      if (!isExpired) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
        const shareUrl = `${baseUrl}/share/jobs/${existingShare.share_token}`
        
        return NextResponse.json({
          success: true,
          shareUrl,
          token: existingShare.share_token,
          expiresAt: existingShare.expires_at,
          isExisting: true
        })
      }
    }

    // Calculate expiration date
    let expiresAt = null
    if (expiresInDays && expiresInDays > 0) {
      const expireDate = new Date()
      expireDate.setDate(expireDate.getDate() + expiresInDays)
      expiresAt = expireDate.toISOString()
    }

    // Generate unique share token
    const shareToken = Math.random().toString(36).substring(2) + Date.now().toString(36)

    // Create share link
    const { data: share, error: shareError } = await supabase
      .from('job_shares')
      .insert({
        job_id: jobId,
        share_token: shareToken,
        created_by: user.id,
        expires_at: expiresAt
      })
      .select('share_token, created_at, expires_at')
      .single()

    if (shareError) {
      console.error('Error creating share:', shareError)
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
    }

    // Construct full share URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const shareUrl = `${baseUrl}/share/jobs/${share.share_token}`

    return NextResponse.json({
      success: true,
      shareUrl,
      token: share.share_token,
      expiresAt: share.expires_at,
      isExisting: false
    })

  } catch (error) {
    console.error('Error in job share creation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


