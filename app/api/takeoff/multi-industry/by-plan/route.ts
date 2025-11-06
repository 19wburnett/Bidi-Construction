import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { multiIndustryTakeoffOrchestrator, type MultiIndustryTakeoffInput } from '@/lib/multi-industry-takeoff-orchestrator'
import { createClient } from '@supabase/supabase-js'

type UsersTableRow = {
  is_admin?: boolean | null
}

function buildErrorResult(message: string) {
  const result: [any[], any[], any[], any[]] = [
    [],
    [],
    [],
    [
      {
        type: 'error' as const,
        message
      }
    ]
  ]
  return result
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(buildErrorResult('Authentication required'), { status: 401 })
    }

    // Ensure caller is an admin (admin tools only)
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single<UsersTableRow>()

    if (userError) {
      console.error('Failed to load user admin flag:', userError)
      return NextResponse.json(buildErrorResult('Failed to verify permissions'), { status: 500 })
    }

    if (!userRow?.is_admin) {
      return NextResponse.json(buildErrorResult('Admin access required'), { status: 403 })
    }

    const body = await request.json()
    const { plan_id: planId } = body

    if (!planId || typeof planId !== 'string') {
      return NextResponse.json(buildErrorResult('plan_id is required'), { status: 400 })
    }

    // Fetch plan metadata
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, job_id, file_path, title, project_name, project_location')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(buildErrorResult('Plan not found'), { status: 404 })
    }

    if (!plan.file_path) {
      return NextResponse.json(buildErrorResult('Plan is missing a file path'), { status: 400 })
    }

    const storageClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        )
      : supabase

    let primaryPdfUrl: string | null = null
    if (plan.file_path.startsWith('http')) {
      primaryPdfUrl = plan.file_path
    } else {
      const bucketsToTry = ['plans', 'job-plans']

      for (const bucket of bucketsToTry) {
        const relativePath = plan.file_path.startsWith(`${bucket}/`)
          ? plan.file_path.slice(bucket.length + 1)
          : plan.file_path

        const { data: signedUrlData, error: signedUrlError } = await storageClient.storage
          .from(bucket)
          .createSignedUrl(relativePath, 60 * 60)

        if (signedUrlError) {
          console.warn('Signed URL attempt failed', {
            bucket,
            relativePath,
            error: signedUrlError.message
          })
          continue
        }

        if (signedUrlData?.signedUrl) {
          primaryPdfUrl = signedUrlData.signedUrl
          break
        }
      }

      if (!primaryPdfUrl) {
        console.error('Failed to create signed URL for plan file:', plan.file_path)
        return NextResponse.json(
          buildErrorResult(
            `Unable to access plan file at ${plan.file_path}. Verify storage bucket permissions and path.`
          ),
          { status: 500 }
        )
      }
    }

    const additionalPdfUrls: string[] = Array.isArray(body.additional_pdf_urls)
      ? body.additional_pdf_urls.filter((url: unknown) => typeof url === 'string' && url.length > 0)
      : []

    const pdfUrls = [primaryPdfUrl, ...additionalPdfUrls].filter(Boolean) as string[]

    let resolvedBuildingType: string | undefined = body.job_context?.building_type

    if (!resolvedBuildingType && plan.job_id) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('project_type')
        .eq('id', plan.job_id)
        .single()

      if (jobData?.project_type) {
        resolvedBuildingType = jobData.project_type === 'Commercial' ? 'commercial' : 'residential'
      }
    }

    const jobContext = {
      project_name: body.job_context?.project_name || plan.project_name || plan.title || 'Untitled Project',
      location: body.job_context?.location || plan.project_location || 'Unknown',
      building_type: resolvedBuildingType || 'commercial',
      notes: body.job_context?.notes || body.notes || ''
    }

    const input: MultiIndustryTakeoffInput = {
      pdf_urls: pdfUrls,
      job_context: jobContext,
      ask_scoping_questions: body.ask_scoping_questions !== false,
      page_batch_size: body.page_batch_size,
      max_parallel_batches: body.max_parallel_batches,
      currency: body.currency || 'USD',
      unit_cost_policy: body.unit_cost_policy || 'estimate',
      prior_segments: body.prior_segments
    }

    const result = await multiIndustryTakeoffOrchestrator.execute(input)

    if (!Array.isArray(result) || result.length !== 4) {
      console.error('Invalid orchestrator output', { planId, result })
      return NextResponse.json(buildErrorResult('Unexpected orchestrator output'), { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error: any) {
    console.error('Multi-industry by-plan error:', error)

    return NextResponse.json(
      buildErrorResult(`Pipeline failed: ${error?.message || 'Unknown error'}`),
      { status: 500 }
    )
  }
}
