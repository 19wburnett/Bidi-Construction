import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { takeoffOrchestrator } from '@/lib/takeoff-orchestrator'

/**
 * POST /api/takeoff/start
 * 
 * Creates a new takeoff job and begins processing
 * 
 * SAFETY FEATURES:
 * - Admin-only access (or feature flag)
 * - Rate limiting (max concurrent jobs per user)
 * - Resource limits (max pages per job)
 * - User isolation (each user only sees their own jobs)
 */
export async function POST(request: NextRequest) {
  try {
    // Hardcoded settings for testing (no env vars needed)
    const ADMIN_ONLY = true // Only admins can use it
    const MAX_CONCURRENT_JOBS = 3 // Max concurrent jobs per user
    const MAX_PAGES = 200 // Max pages per job (your test PDF has 111)

    // Check if this is a service role call (for Edge Function or testing)
    const authHeader = request.headers.get('authorization')
    const isServiceRole = authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    
    // Use service role client if this is a service role call
    let supabase
    if (isServiceRole) {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    } else {
      supabase = await createServerSupabaseClient()
    }
    
    // Parse body first (can only be read once)
    const body = await request.json()
    const {
      job_id,
      plan_id,
      pdf_ref,
      model_policy,
      batch_config,
      pages,
      mode = 'both'
    } = body
    
    let user
    if (isServiceRole) {
      // Service role call - get user from plan's job
      // First check if plan exists and get its job_id
      const { data: planCheck, error: planCheckError } = await supabase
        .from('plans')
        .select('id, job_id')
        .eq('id', plan_id)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid errors
      
      if (planCheckError) {
        console.error('Plan lookup error:', planCheckError)
        console.error('Plan ID searched:', plan_id)
        return NextResponse.json(
          { error: `Database error: ${planCheckError.message}` },
          { status: 500 }
        )
      }
      
      if (!planCheck || !planCheck.job_id) {
        // Try to find any plan to debug
        const { data: anyPlan } = await supabase
          .from('plans')
          .select('id, file_name')
          .limit(1)
        
        console.error(`Plan ${plan_id} not found or has no job_id. Sample plan IDs:`, anyPlan?.map(p => p.id))
        return NextResponse.json(
          { error: `Plan not found or not associated with a job: ${plan_id}` },
          { status: 404 }
        )
      }
      
      // Get user_id from the job
      const { data: jobCheck, error: jobError } = await supabase
        .from('jobs')
        .select('user_id')
        .eq('id', planCheck.job_id)
        .single()
      
      if (jobError || !jobCheck) {
        console.error('Job lookup error:', jobError)
        return NextResponse.json(
          { error: `Job not found for plan: ${plan_id}` },
          { status: 404 }
        )
      }
      
      user = { id: jobCheck.user_id }
    } else {
      // Regular user call - verify auth
      const { data: { user: userData }, error: authError } = await supabase.auth.getUser()

      if (authError || !userData) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      user = { id: userData.id }

      // Check if user is admin (for live site safety)
      if (ADMIN_ONLY) {
        const { data: adminCheck, error: adminError } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (adminError || !adminCheck) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          )
        }

        // Only check is_admin boolean, not role
        if (!adminCheck.is_admin) {
          return NextResponse.json(
            { error: 'Admin access required for takeoff orchestrator' },
            { status: 403 }
          )
        }
      }

      // Rate limiting: Check for active jobs
      const { data: activeJobs } = await supabase
        .from('takeoff_jobs')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['queued', 'running', 'partial'])
        .limit(10)

      if (activeJobs && activeJobs.length >= MAX_CONCURRENT_JOBS) {
        return NextResponse.json(
          { 
            error: `Too many active jobs. Maximum ${MAX_CONCURRENT_JOBS} concurrent jobs allowed.`,
            active_jobs: activeJobs.length
          },
          { status: 429 }
        )
      }
    }

    // Validation
    if (!job_id || !plan_id || !pdf_ref) {
      return NextResponse.json(
        { error: 'Missing required fields: job_id, plan_id, pdf_ref' },
        { status: 400 }
      )
    }

    // Resource limits: Check page count
    if (pages?.end && pages.end > MAX_PAGES) {
      return NextResponse.json(
        { error: `Page limit exceeded. Maximum ${MAX_PAGES} pages allowed.` },
        { status: 400 }
      )
    }

    // Verify plan ownership (skip user check for service role)
    let plan
    if (isServiceRole) {
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', plan_id)
        .single()

      if (planError || !planData) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        )
      }
      plan = planData
    } else {
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', plan_id)
        .eq('user_id', user.id)
        .single()

      if (planError || !planData) {
        return NextResponse.json(
          { error: 'Plan not found or access denied' },
          { status: 404 }
        )
      }
      plan = planData
    }

    // Create job
    const job = await takeoffOrchestrator.createJob({
      job_id,
      plan_id,
      user_id: user.id,
      pdf_ref,
      model_policy,
      batch_config,
      pages,
      mode
    })

    // Check if job exceeds page limit
    if (job.total_pages > MAX_PAGES) {
      // Mark job as failed
      await supabase
        .from('takeoff_jobs')
        .update({ 
          status: 'failed',
          errors: [{ message: `Page limit exceeded: ${job.total_pages} > ${MAX_PAGES}` }]
        })
        .eq('id', job.id)

      return NextResponse.json(
        { error: `Page limit exceeded. Job has ${job.total_pages} pages, maximum ${MAX_PAGES} allowed.` },
        { status: 400 }
      )
    }

    // Start processing (async - don't await)
    // Process initial batches in this request (up to timeout)
    // Use longer timeout for production (30s instead of 8s)
    const timeout = process.env.NODE_ENV === 'production' ? 30000 : 8000
    takeoffOrchestrator.processBatches(job.id, 3, timeout).catch(console.error)

    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: job.status,
      total_batches: job.total_batches,
      total_pages: job.total_pages,
      estimated_time_minutes: Math.ceil(job.total_batches * 0.5) // Rough estimate
    })

  } catch (error: any) {
    console.error('Takeoff start error:', error)
    return NextResponse.json(
      {
        error: 'Failed to start takeoff job',
        details: error.message
      },
      { status: 500 }
    )
  }
}

