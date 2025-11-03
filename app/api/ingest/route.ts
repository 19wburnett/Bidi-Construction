import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { ingestPlan } from '@/lib/ingestion-engine'

/**
 * POST /api/ingest
 * 
 * Ingests a plan PDF, extracts text/images, builds sheet index, and generates chunks.
 * 
 * Request body:
 * {
 *   planId: string (required)
 *   jobId?: string (optional)
 *   options?: {
 *     target_chunk_size_tokens?: number (default: 3000)
 *     overlap_percentage?: number (default: 17.5)
 *     max_chunk_size_tokens?: number (default: 4000)
 *     min_chunk_size_tokens?: number (default: 2000)
 *     enable_dedupe?: boolean (default: true)
 *     enable_image_extraction?: boolean (default: false - text-only mode, no API keys needed)
 *     image_dpi?: number (default: 300)
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { planId, jobId, options } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    // Verify plan ownership
    const supabase = await createServerSupabaseClient()
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or access denied' },
        { status: 404 }
      )
    }

    // Check if already processed (optional - allow re-processing)
    const { data: existingChunks } = await supabase
      .from('plan_chunks')
      .select('chunk_id')
      .eq('plan_id', planId)
      .limit(1)

    if (existingChunks && existingChunks.length > 0) {
      // Allow re-processing but warn user
      console.log(`Plan ${planId} already has chunks - will overwrite`)
    }
    
    // Also check if ingestion is already in progress
    const { data: planStatus } = await supabase
      .from('plans')
      .select('processing_status, status')
      .eq('id', planId)
      .single()
    
    const isIngesting = planStatus?.processing_status?.stage === 'chunking' || 
                       planStatus?.processing_status?.stage === 'extracting' ||
                       planStatus?.processing_status?.stage === 'indexing' ||
                       planStatus?.status === 'processing'
    
    if (isIngesting) {
      return NextResponse.json({
        success: false,
        error: 'Ingestion already in progress',
        message: `Plan is currently being processed (stage: ${planStatus?.processing_status?.stage || 'unknown'})`
      }, { status: 409 })
    }

    // Update status to processing
    await supabase
      .from('plans')
      .update({ 
        status: 'processing',
        processing_status: {
          stage: 'queued',
          progress: 0,
          current_step: 'Initializing ingestion',
          started_at: new Date().toISOString()
        }
      })
      .eq('id', planId)

    // Run ingestion
    const result = await ingestPlan(plan, user.id, jobId, options)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Ingestion error:', error)
    return NextResponse.json(
      { 
        error: 'Ingestion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

