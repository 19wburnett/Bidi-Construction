import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { enrichSubcontractorFree, EnrichmentResults, EnrichmentSources } from '@/lib/free-enrichment'
import { downloadAndUploadImage } from '@/lib/enrichment-image-handler'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow longer execution for crawling

/**
 * POST - Run enrichment for a single subcontractor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subcontractorId } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Fetch the subcontractor
    const { data: subcontractor, error: fetchError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', subcontractorId)
      .single()

    if (fetchError || !subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Create admin client for operations that need to bypass RLS
    const supabaseAdmin = createAdminSupabaseClient()

    // Create enrichment record with 'running' status
    const { data: enrichmentRecord, error: insertError } = await supabaseAdmin
      .from('subcontractor_enrichments')
      .insert({
        subcontractor_id: subcontractorId,
        status: 'running',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating enrichment record:', insertError)
      return NextResponse.json({ error: 'Failed to create enrichment record' }, { status: 500 })
    }

    // Update subcontractor enrichment status
    await supabaseAdmin
      .from('subcontractors')
      .update({ enrichment_status: 'running', enrichment_updated_at: new Date().toISOString() })
      .eq('id', subcontractorId)

    try {
      // Run free enrichment (no API keys needed)
      const { results, sources } = await enrichSubcontractorFree({
        id: subcontractor.id,
        name: subcontractor.name,
        trade_category: subcontractor.trade_category,
        location: subcontractor.location,
        website_url: subcontractor.website_url,
      })

      // If we found a logo URL, download and upload it to Supabase Storage
      if (results.logo_url) {
        console.log('Processing logo image...')
        const uploadResult = await downloadAndUploadImage(subcontractorId, results.logo_url)
        if (uploadResult.success && uploadResult.publicUrl) {
          results.logo_url = uploadResult.publicUrl
          if (sources.logo_url) {
            sources.logo_url.extracted_text = `Uploaded to Supabase Storage`
          }
        }
      }

      // Update enrichment record with results
      const { error: updateError } = await supabaseAdmin
        .from('subcontractor_enrichments')
        .update({
          status: 'complete',
          results_json: results,
          sources_json: sources,
        })
        .eq('id', enrichmentRecord.id)

      if (updateError) {
        console.error('Error updating enrichment record:', updateError)
      }

      // Update subcontractor enrichment status
      await supabaseAdmin
        .from('subcontractors')
        .update({ 
          enrichment_status: 'complete', 
          enrichment_updated_at: new Date().toISOString() 
        })
        .eq('id', subcontractorId)

      // Count fields found
      const fieldsFound = Object.entries(results)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key]) => key)

      return NextResponse.json({
        success: true,
        message: `Enrichment complete. Found ${fieldsFound.length} fields.`,
        enrichmentId: enrichmentRecord.id,
        fieldsFound,
        results,
        sources,
      })

    } catch (enrichError) {
      // Update enrichment record with error
      const errorMessage = enrichError instanceof Error ? enrichError.message : 'Unknown error'
      
      await supabaseAdmin
        .from('subcontractor_enrichments')
        .update({
          status: 'error',
          error_message: errorMessage,
          results_json: {},
          sources_json: {},
        })
        .eq('id', enrichmentRecord.id)

      await supabaseAdmin
        .from('subcontractors')
        .update({ 
          enrichment_status: 'error', 
          enrichment_updated_at: new Date().toISOString() 
        })
        .eq('id', subcontractorId)

      throw enrichError
    }

  } catch (error) {
    console.error('Error enriching subcontractor:', error)
    return NextResponse.json(
      {
        error: 'Failed to enrich subcontractor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - Enrich multiple subcontractors in batch
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { subcontractorIds } = body

    if (!Array.isArray(subcontractorIds) || subcontractorIds.length === 0) {
      return NextResponse.json({ error: 'Subcontractor IDs array is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Create admin client for operations that need to bypass RLS
    const supabaseAdmin = createAdminSupabaseClient()

    // Fetch all subcontractors
    const { data: subcontractors, error: batchFetchError } = await supabase
      .from('subcontractors')
      .select('*')
      .in('id', subcontractorIds)

    if (batchFetchError || !subcontractors || subcontractors.length === 0) {
      return NextResponse.json({ error: 'Subcontractors not found' }, { status: 404 })
    }

    const results: Array<{
      id: string
      name: string
      success: boolean
      error?: string
      message?: string
      fieldsFound?: string[]
      enrichmentId?: string
    }> = []
    const errors: Array<{
      id: string
      name: string
      error: string
    }> = []

    // Process each subcontractor with delays to avoid rate limiting
    for (let i = 0; i < subcontractors.length; i++) {
      const subcontractor = subcontractors[i]
      console.log(`\nProcessing ${i + 1}/${subcontractors.length}: ${subcontractor.name}`)

      try {
        // Create enrichment record
        const { data: enrichmentRecord, error: insertError } = await supabaseAdmin
          .from('subcontractor_enrichments')
          .insert({
            subcontractor_id: subcontractor.id,
            status: 'running',
          })
          .select()
          .single()

        if (insertError) {
          errors.push({
            id: subcontractor.id,
            name: subcontractor.name,
            error: 'Failed to create enrichment record',
          })
          continue
        }

        // Update subcontractor status
        await supabaseAdmin
          .from('subcontractors')
          .update({ enrichment_status: 'running', enrichment_updated_at: new Date().toISOString() })
          .eq('id', subcontractor.id)

        // Run enrichment
        const enrichResult = await enrichSubcontractorFree({
          id: subcontractor.id,
          name: subcontractor.name,
          trade_category: subcontractor.trade_category,
          location: subcontractor.location,
          website_url: subcontractor.website_url,
        })

        // Upload logo if found
        if (enrichResult.results.logo_url) {
          const uploadResult = await downloadAndUploadImage(subcontractor.id, enrichResult.results.logo_url)
          if (uploadResult.success && uploadResult.publicUrl) {
            enrichResult.results.logo_url = uploadResult.publicUrl
          }
        }

        // Update enrichment record
        await supabaseAdmin
          .from('subcontractor_enrichments')
          .update({
            status: 'complete',
            results_json: enrichResult.results,
            sources_json: enrichResult.sources,
          })
          .eq('id', enrichmentRecord.id)

        // Update subcontractor status
        await supabaseAdmin
          .from('subcontractors')
          .update({ 
            enrichment_status: 'complete', 
            enrichment_updated_at: new Date().toISOString() 
          })
          .eq('id', subcontractor.id)

        const fieldsFound = Object.entries(enrichResult.results)
          .filter(([_, value]) => value !== null && value !== undefined)
          .map(([key]) => key)

        results.push({
          id: subcontractor.id,
          name: subcontractor.name,
          success: true,
          message: `Found ${fieldsFound.length} fields`,
          fieldsFound,
          enrichmentId: enrichmentRecord.id,
        })

        // Add delay between requests to avoid rate limiting (except for the last one)
        if (i < subcontractors.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }

      } catch (error) {
        console.error(`Error enriching ${subcontractor.name}:`, error)
        
        // Update subcontractor status to error
        await supabaseAdmin
          .from('subcontractors')
          .update({ 
            enrichment_status: 'error', 
            enrichment_updated_at: new Date().toISOString() 
          })
          .eq('id', subcontractor.id)

        errors.push({
          id: subcontractor.id,
          name: subcontractor.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: subcontractors.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    })

  } catch (error) {
    console.error('Error in batch enrichment:', error)
    return NextResponse.json(
      {
        error: 'Failed to enrich subcontractors',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}





