import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { enrichSubcontractorFree } from '@/lib/free-enrichment'
import { downloadAndUploadImage } from '@/lib/enrichment-image-handler'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for enrichment

/**
 * Cron endpoint for automatically enriching subcontractors
 * 
 * This endpoint runs every 30 minutes and slowly enriches subcontractors
 * that haven't been enriched yet or had their enrichment declined/rejected.
 * Results are created with status 'complete' and appear in the admin dashboard
 * for review and approval.
 * 
 * Security: Validates CRON_SECRET header to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require CRON_SECRET
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('🚫 Unauthorized cron request')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    console.log('🔍 Starting automatic subcontractor enrichment cron job...')
    const supabaseAdmin = createAdminSupabaseClient()
    
    // Find subcontractors that need enrichment:
    // 1. Never enriched (enrichment_status is null)
    // 2. Previous enrichment failed (enrichment_status is 'error')
    // 3. Enrichment was declined/rejected (enrichment_status is 'rejected')
    // Exclude: Currently running enrichments
    
    // Get all subcontractors that need enrichment
    const { data: allSubcontractors, error: fetchError } = await supabaseAdmin
      .from('subcontractors')
      .select('id, name, trade_category, location, website_url, enrichment_status, enrichment_updated_at')
      .or(`enrichment_status.is.null,enrichment_status.eq.error,enrichment_status.eq.rejected`)
      .neq('enrichment_status', 'running')
      .order('enrichment_updated_at', { ascending: true, nullsFirst: true })
      .limit(100) // Get a larger pool to filter from

    if (fetchError) {
      console.error('Error fetching subcontractors:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch subcontractors', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!allSubcontractors || allSubcontractors.length === 0) {
      console.log('✅ No subcontractors need enrichment')
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No subcontractors need enrichment',
      })
    }

    // All subcontractors returned from the query are candidates for enrichment:
    // - enrichment_status is null (never enriched)
    // - enrichment_status is 'error' (previous enrichment failed)
    // - enrichment_status is 'rejected' (enrichment was declined)
    const candidates = allSubcontractors

    if (candidates.length === 0) {
      console.log('✅ No subcontractors need enrichment')
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No subcontractors need enrichment',
      })
    }

    // Process 1-2 subcontractors per run (to go slowly)
    const toProcess = candidates.slice(0, 2)
    
    console.log(`📋 Found ${candidates.length} subcontractor(s) needing enrichment, processing ${toProcess.length}`)

    const results = []
    const errors = []

    for (const subcontractor of toProcess) {
      let enrichmentRecordId: string | null = null
      
      try {
        console.log(`\n🔄 Enriching: ${subcontractor.name} (${subcontractor.id})`)
        
        // Create enrichment record with 'running' status
        const { data: enrichmentRecord, error: insertError } = await supabaseAdmin
          .from('subcontractor_enrichments')
          .insert({
            subcontractor_id: subcontractor.id,
            status: 'running',
          })
          .select()
          .single()

        if (insertError) {
          console.error(`❌ Failed to create enrichment record for ${subcontractor.name}:`, insertError)
          errors.push({
            id: subcontractor.id,
            name: subcontractor.name,
            error: 'Failed to create enrichment record',
          })
          continue
        }

        enrichmentRecordId = enrichmentRecord.id

        // Update subcontractor enrichment status
        await supabaseAdmin
          .from('subcontractors')
          .update({ 
            enrichment_status: 'running', 
            enrichment_updated_at: new Date().toISOString() 
          })
          .eq('id', subcontractor.id)

        // Run enrichment
        const { results: enrichResults, sources } = await enrichSubcontractorFree({
          id: subcontractor.id,
          name: subcontractor.name,
          trade_category: subcontractor.trade_category,
          location: subcontractor.location,
          website_url: subcontractor.website_url,
        })

        // If we found a logo URL, download and upload it to Supabase Storage
        if (enrichResults.logo_url) {
          console.log(`📥 Processing logo for ${subcontractor.name}...`)
          const uploadResult = await downloadAndUploadImage(subcontractor.id, enrichResults.logo_url)
          if (uploadResult.success && uploadResult.publicUrl) {
            enrichResults.logo_url = uploadResult.publicUrl
            if (sources.logo_url) {
              sources.logo_url.extracted_text = `Uploaded to Supabase Storage`
            }
          }
        }

        // Update enrichment record with results (status: 'complete' - ready for admin review)
        const { error: updateError } = await supabaseAdmin
          .from('subcontractor_enrichments')
          .update({
            status: 'complete',
            results_json: enrichResults,
            sources_json: sources,
          })
          .eq('id', enrichmentRecordId)

        if (updateError) {
          console.error(`❌ Failed to update enrichment record for ${subcontractor.name}:`, updateError)
          errors.push({
            id: subcontractor.id,
            name: subcontractor.name,
            error: 'Failed to update enrichment record',
          })
          continue
        }

        // Update subcontractor enrichment status to 'complete' (awaiting approval)
        await supabaseAdmin
          .from('subcontractors')
          .update({ 
            enrichment_status: 'complete', 
            enrichment_updated_at: new Date().toISOString() 
          })
          .eq('id', subcontractor.id)

        // Count fields found
        const fieldsFound = Object.entries(enrichResults)
          .filter(([_, value]) => value !== null && value !== undefined)
          .map(([key]) => key)

        console.log(`✅ Enriched ${subcontractor.name}: Found ${fieldsFound.length} fields`)

        results.push({
          id: subcontractor.id,
          name: subcontractor.name,
          success: true,
          enrichmentId: enrichmentRecordId,
          fieldsFound,
        })

      } catch (error) {
        console.error(`❌ Error enriching ${subcontractor.name}:`, error)
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Update enrichment record with error if we created one
        if (enrichmentRecordId) {
          await supabaseAdmin
            .from('subcontractor_enrichments')
            .update({
              status: 'error',
              error_message: errorMessage,
            })
            .eq('id', enrichmentRecordId)
        }

        // Update subcontractor enrichment status to error
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
          error: errorMessage,
        })
      }
    }

    const processed = results.length
    const failed = errors.length

    console.log(`\n✅ Enrichment cron job complete: ${processed} successful, ${failed} failed`)

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: toProcess.length,
      results,
      errors,
    })

  } catch (error) {
    console.error('❌ Enrichment cron job error:', error)
    return NextResponse.json(
      {
        error: 'Enrichment cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
