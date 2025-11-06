import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { multiIndustryTakeoffOrchestrator, type MultiIndustryTakeoffInput } from '@/lib/multi-industry-takeoff-orchestrator'

/**
 * POST /api/takeoff/multi-industry
 * 
 * Multi-Industry Takeoff Orchestrator API
 * 
 * Two-stage pipeline:
 * 1. SCOPING: Ask questions, generate segment plan
 * 2. EXECUTION: Process each segment in batches
 * 
 * Returns arrays-only output: [TAKEOFF[], ANALYSIS[], SEGMENTS[], RUN_LOG[]]
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    
    // Validate required fields
    if (!body.pdf_urls || !Array.isArray(body.pdf_urls) || body.pdf_urls.length === 0) {
      return NextResponse.json(
        { error: 'pdf_urls array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (!body.job_context) {
      return NextResponse.json(
        { error: 'job_context is required' },
        { status: 400 }
      )
    }

    // Build input
    const input: MultiIndustryTakeoffInput = {
      pdf_urls: body.pdf_urls,
      job_context: {
        project_name: body.job_context.project_name || 'Untitled Project',
        location: body.job_context.location || '',
        building_type: body.job_context.building_type || 'residential',
        notes: body.job_context.notes
      },
      ask_scoping_questions: body.ask_scoping_questions !== false, // default true
      page_batch_size: body.page_batch_size || 5,
      max_parallel_batches: body.max_parallel_batches || 2,
      currency: body.currency || 'USD',
      unit_cost_policy: body.unit_cost_policy || 'estimate',
      prior_segments: body.prior_segments
    }

    // Execute pipeline (orchestrator will initialize supabase if needed)
    const result = await multiIndustryTakeoffOrchestrator.execute(input)

    // Validate output shape (must be exactly 4 arrays)
    if (!Array.isArray(result) || result.length !== 4) {
      return NextResponse.json(
        { 
          error: 'Invalid output format: expected array with 4 elements',
          details: 'Output must be [TAKEOFF[], ANALYSIS[], SEGMENTS[], RUN_LOG[]]'
        },
        { status: 500 }
      )
    }

    // Return arrays-only output
    return NextResponse.json(result, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error: any) {
    console.error('Multi-industry takeoff error:', error)
    
    // Return error in arrays-only format if possible
    const errorResult: [any[], any[], any[], any[]] = [
      [], // TAKEOFF
      [], // ANALYSIS
      [], // SEGMENTS
      [{ // RUN_LOG
        type: 'error' as const,
        message: `Pipeline failed: ${error.message || 'Unknown error'}`
      }]
    ]

    return NextResponse.json(
      errorResult,
      { status: 500 }
    )
  }
}

/**
 * GET /api/takeoff/multi-industry
 * 
 * Health check and documentation
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    name: 'Multi-Industry Takeoff Orchestrator',
    version: '1.0.0',
    description: 'Two-stage pipeline for automated plan takeoffs',
    stages: [
      {
        name: 'SCOPING',
        description: 'Ask minimal questions and synthesize normalized segmentation plan'
      },
      {
        name: 'EXECUTION',
        description: 'Process each segment in batches, merge/deduplicate results'
      }
    ],
    output_format: {
      type: 'array',
      length: 4,
      elements: [
        {
          index: 0,
          name: 'TAKEOFF',
          description: 'All takeoff items across all segments (flat array)'
        },
        {
          index: 1,
          name: 'ANALYSIS',
          description: 'Normalized issues/RFIs/conflicts (flat array)'
        },
        {
          index: 2,
          name: 'SEGMENTS',
          description: 'Per-segment structured results'
        },
        {
          index: 3,
          name: 'RUN_LOG',
          description: 'Processing notes, batching, and errors'
        }
      ]
    },
    usage: {
      method: 'POST',
      endpoint: '/api/takeoff/multi-industry',
      body: {
        pdf_urls: ['string[]'],
        job_context: {
          project_name: 'string',
          location: 'string',
          building_type: 'residential|commercial|industrial|institutional|string',
          notes: 'string (optional)'
        },
        ask_scoping_questions: 'boolean (default: true)',
        page_batch_size: 'number (default: 5)',
        max_parallel_batches: 'number (default: 2)',
        currency: 'string (default: "USD")',
        unit_cost_policy: 'estimate|lookup|mixed (default: "estimate")',
        prior_segments: '[{industry: string, categories: string[]}] (optional)'
      }
    }
  })
}

