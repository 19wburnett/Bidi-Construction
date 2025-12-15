import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/plan/share/[token] - Validate share token and get plan info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Query the plan_shares table directly to validate token and get plan info
    const { data: shareData, error: shareError } = await supabase
      .from('plan_shares')
      .select(`
        id,
        plan_id,
        permissions,
        expires_at,
        created_at,
        accessed_count,
        created_by
      `)
      .eq('share_token', token)
      .single()

    if (shareError) {
      console.error('Error validating share token:', shareError)
      return NextResponse.json({ error: 'Failed to validate share token' }, { status: 500 })
    }

    if (!shareData) {
      return NextResponse.json({ 
        error: 'Invalid or expired share link',
        valid: false 
      }, { status: 404 })
    }

    // Check if link is expired
    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'Share link has expired',
        valid: false 
      }, { status: 404 })
    }

    // Get the plan details - return all fields needed for the viewer
    const { data: planData, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', shareData.plan_id)
      .single()

    if (planError || !planData) {
      console.error('Error fetching plan:', planError)
      return NextResponse.json({ 
        error: 'Plan not found',
        valid: false 
      }, { status: 404 })
    }

    // Create signed URL for PDF if needed
    let pdfUrl = planData.file_path
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      // Try to get signed URL from storage
      const bucketsToTry = ['job-plans', 'plans']
      
      for (const bucket of bucketsToTry) {
        const candidatePaths = [pdfUrl]
        if (pdfUrl.startsWith(`${bucket}/`)) {
          candidatePaths.push(pdfUrl.slice(bucket.length + 1))
        }
        
        // Handle fully-qualified public URLs stored in the database
        if (pdfUrl.includes('/storage/v1/object/public/')) {
          const [, afterPublic] = pdfUrl.split('/storage/v1/object/public/')
          if (afterPublic) {
            candidatePaths.push(afterPublic)
          }
        }

        for (const candidatePath of candidatePaths) {
          const { data: urlData, error: urlError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(candidatePath, 3600)

          if (!urlError && urlData?.signedUrl) {
            pdfUrl = urlData.signedUrl
            break
          }
        }
        
        if (pdfUrl.startsWith('http')) break
      }
    }

    // Update access count and last accessed time
    await supabase
      .from('plan_shares')
      .update({ 
        accessed_count: (shareData.accessed_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', shareData.id)

    // Map permissions to allowComments and allowDrawings
    const permissions = shareData.permissions || 'view_only'
    const allowComments = permissions === 'comment' || permissions === 'all'
    const allowDrawings = permissions === 'markup' || permissions === 'all'

    // Get the owner's email
    const { data: ownerData } = await supabase
      .from('users')
      .select('email')
      .eq('id', shareData.created_by)
      .single()

    // Load takeoff analysis if available
    let takeoffData = null
    if (planData.job_id) {
      const { data: takeoffAnalysis } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('job_id', planData.job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (takeoffAnalysis) {
        takeoffData = takeoffAnalysis
      }
    }

    return NextResponse.json({
      success: true,
      valid: true,
      share: {
        id: shareData.id,
        permissions: shareData.permissions,
        expires_at: shareData.expires_at,
        created_at: shareData.created_at,
        accessed_count: shareData.accessed_count
      },
      plan: {
        ...planData,
        pdfUrl: pdfUrl
      },
      takeoffData: takeoffData,
      permissions: {
        allowComments,
        allowDrawings
      },
      ownerName: ownerData?.email || 'Plan Owner'
    })

  } catch (error) {
    console.error('Error validating share token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

