import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enrichSubcontractor } from '@/lib/firecrawl-enrichment'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subcontractorId } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    const apiKey = process.env.FIRECRAWL_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Firecrawl API key not configured' }, { status: 500 })
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
    const { data: subcontractor, error: initialFetchError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', subcontractorId)
      .single()

    if (initialFetchError || !subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Enrich the subcontractor data
    const enrichmentData = await enrichSubcontractor(
      {
        id: subcontractor.id,
        name: subcontractor.name,
        email: subcontractor.email,
        trade_category: subcontractor.trade_category,
        location: subcontractor.location,
        website_url: subcontractor.website_url,
      },
      apiKey
    )

    // Update the subcontractor with enriched data
    // Only update fields that have values (don't overwrite existing data with null)
    // Only update email if it's currently missing or invalid
    const updateData: Record<string, unknown> = {}
    if (enrichmentData.email !== undefined && enrichmentData.email !== null) {
      // Only update email if the current email is missing or invalid
      const currentEmail = subcontractor.email || ''
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!currentEmail || !emailRegex.test(currentEmail)) {
        updateData.email = enrichmentData.email.toLowerCase().trim()
      }
    }
    if (enrichmentData.phone !== undefined && enrichmentData.phone !== null) updateData.phone = enrichmentData.phone
    if (enrichmentData.website_url !== undefined && enrichmentData.website_url !== null) updateData.website_url = enrichmentData.website_url
    if (enrichmentData.google_review_score !== undefined && enrichmentData.google_review_score !== null)
      updateData.google_review_score = enrichmentData.google_review_score
    if (enrichmentData.google_reviews_link !== undefined && enrichmentData.google_reviews_link !== null)
      updateData.google_reviews_link = enrichmentData.google_reviews_link
    if (enrichmentData.time_in_business !== undefined && enrichmentData.time_in_business !== null)
      updateData.time_in_business = enrichmentData.time_in_business
    if (enrichmentData.licensed !== undefined && enrichmentData.licensed !== null) updateData.licensed = enrichmentData.licensed
    if (enrichmentData.bonded !== undefined && enrichmentData.bonded !== null) updateData.bonded = enrichmentData.bonded
    if (enrichmentData.notes !== undefined && enrichmentData.notes !== null) updateData.notes = enrichmentData.notes
    if (enrichmentData.profile_picture_url !== undefined && enrichmentData.profile_picture_url !== null) 
      updateData.profile_picture_url = enrichmentData.profile_picture_url
    // Handle references as JSONB - only include if it's a valid object/array
    if (enrichmentData.references !== undefined && enrichmentData.references !== null) {
      // Ensure references is a valid JSON-serializable object
      try {
        JSON.stringify(enrichmentData.references)
        updateData.references = enrichmentData.references
      } catch (e) {
        console.warn('Invalid references data, skipping:', e)
      }
    }

    // Track what fields were found
    const fieldsFound: string[] = []
    const fieldsUpdated: string[] = []

    // Check what enrichment data was found (even if we won't update)
    if (enrichmentData.email) fieldsFound.push('email')
    if (enrichmentData.phone) fieldsFound.push('phone')
    if (enrichmentData.website_url) fieldsFound.push('website_url')
    if (enrichmentData.google_review_score !== null && enrichmentData.google_review_score !== undefined) fieldsFound.push('google_review_score')
    if (enrichmentData.google_reviews_link) fieldsFound.push('google_reviews_link')
    if (enrichmentData.time_in_business) fieldsFound.push('time_in_business')
    if (enrichmentData.licensed !== null && enrichmentData.licensed !== undefined) fieldsFound.push('licensed')
    if (enrichmentData.bonded !== null && enrichmentData.bonded !== undefined) fieldsFound.push('bonded')
    if (enrichmentData.notes) fieldsFound.push('notes')
    if (enrichmentData.references) fieldsFound.push('references')
    if (enrichmentData.profile_picture_url) fieldsFound.push('profile_picture_url')

    // Only update if we have data to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: fieldsFound.length > 0 
          ? `Found data but no updates needed (data already exists or is invalid)`
          : 'No new data found',
        fieldsFound,
        fieldsUpdated: [],
        subcontractor,
        enrichmentData,
      })
    }

    // Track what we're actually updating
    fieldsUpdated.push(...Object.keys(updateData))

    // First, check if the subcontractor still exists
    const { data: existingCheck, error: checkError } = await supabase
      .from('subcontractors')
      .select('id')
      .eq('id', subcontractorId)
      .single()

    if (checkError || !existingCheck) {
      console.error('Error checking subcontractor existence:', checkError)
      return NextResponse.json(
        { 
          error: 'Subcontractor not found',
          details: checkError?.message || 'Subcontractor does not exist',
          fieldsFound,
          fieldsUpdated: [],
        },
        { status: 404 }
      )
    }

    // Perform the update
    const { error: updateError } = await supabase
      .from('subcontractors')
      .update(updateData)
      .eq('id', subcontractorId)

    if (updateError) {
      console.error('Error updating subcontractor:', updateError)
      return NextResponse.json(
        { 
          error: 'Failed to update subcontractor',
          details: updateError.message,
          fieldsFound,
          fieldsUpdated: [],
        },
        { status: 500 }
      )
    }

    // Fetch the updated subcontractor
    const { data: updatedSubcontractor, error: postUpdateFetchError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', subcontractorId)
      .single()

    if (postUpdateFetchError) {
      console.error('Error fetching updated subcontractor:', postUpdateFetchError)
      // Update succeeded but fetch failed - return success with original data plus updates
      return NextResponse.json({
        success: true,
        message: `Successfully updated ${fieldsUpdated.length} field(s) (unable to fetch updated record)`,
        fieldsFound,
        fieldsUpdated,
        subcontractor: { ...subcontractor, ...updateData },
        enrichmentData,
        warning: 'Update succeeded but could not fetch updated record',
      })
    }

    if (!updatedSubcontractor) {
      // This shouldn't happen if update succeeded, but handle it gracefully
      return NextResponse.json({
        success: true,
        message: `Successfully updated ${fieldsUpdated.length} field(s)`,
        fieldsFound,
        fieldsUpdated,
        subcontractor: { ...subcontractor, ...updateData },
        enrichmentData,
        warning: 'Update succeeded but record not found on fetch',
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${fieldsUpdated.length} field(s)`,
      fieldsFound,
      fieldsUpdated,
      subcontractor: updatedSubcontractor,
      enrichmentData,
    })
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
 * Enrich multiple subcontractors in batch
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { subcontractorIds } = body

    if (!Array.isArray(subcontractorIds) || subcontractorIds.length === 0) {
      return NextResponse.json({ error: 'Subcontractor IDs array is required' }, { status: 400 })
    }

    const apiKey = process.env.FIRECRAWL_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Firecrawl API key not configured' }, { status: 500 })
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

    // Fetch all subcontractors
    const { data: subcontractors, error: batchFetchError } = await supabase
      .from('subcontractors')
      .select('*')
      .in('id', subcontractorIds)

    if (batchFetchError || !subcontractors || subcontractors.length === 0) {
      return NextResponse.json({ error: 'Subcontractors not found' }, { status: 404 })
    }

    const results = []
    const errors = []

    // Process each subcontractor with delays to avoid rate limiting
    for (let i = 0; i < subcontractors.length; i++) {
      const subcontractor = subcontractors[i]
      try {
        console.log(`Enriching ${i + 1}/${subcontractors.length}: ${subcontractor.name}`)

        const enrichmentData = await enrichSubcontractor(
          {
            id: subcontractor.id,
            name: subcontractor.name,
            email: subcontractor.email,
            trade_category: subcontractor.trade_category,
            location: subcontractor.location,
            website_url: subcontractor.website_url,
          },
          apiKey
        )

        // Update the subcontractor
        const updateData: Record<string, unknown> = {}
        // Only update email if it's currently missing or invalid
        if (enrichmentData.email !== undefined && enrichmentData.email !== null) {
          const currentEmail = subcontractor.email || ''
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!currentEmail || !emailRegex.test(currentEmail)) {
            updateData.email = enrichmentData.email.toLowerCase().trim()
          }
        }
        if (enrichmentData.phone !== undefined && enrichmentData.phone !== null) updateData.phone = enrichmentData.phone
        if (enrichmentData.website_url !== undefined && enrichmentData.website_url !== null) updateData.website_url = enrichmentData.website_url
        if (enrichmentData.google_review_score !== undefined && enrichmentData.google_review_score !== null)
          updateData.google_review_score = enrichmentData.google_review_score
        if (enrichmentData.google_reviews_link !== undefined && enrichmentData.google_reviews_link !== null)
          updateData.google_reviews_link = enrichmentData.google_reviews_link
        if (enrichmentData.time_in_business !== undefined && enrichmentData.time_in_business !== null)
          updateData.time_in_business = enrichmentData.time_in_business
        if (enrichmentData.licensed !== undefined && enrichmentData.licensed !== null) updateData.licensed = enrichmentData.licensed
        if (enrichmentData.bonded !== undefined && enrichmentData.bonded !== null) updateData.bonded = enrichmentData.bonded
        if (enrichmentData.notes !== undefined && enrichmentData.notes !== null) updateData.notes = enrichmentData.notes
        if (enrichmentData.profile_picture_url !== undefined && enrichmentData.profile_picture_url !== null) 
          updateData.profile_picture_url = enrichmentData.profile_picture_url
        // Handle references as JSONB - only include if it's a valid object/array
        if (enrichmentData.references !== undefined && enrichmentData.references !== null) {
          try {
            JSON.stringify(enrichmentData.references)
            updateData.references = enrichmentData.references
          } catch (e) {
            console.warn(`Invalid references data for ${subcontractor.name}, skipping:`, e)
          }
        }

        // Track what fields were found
        const fieldsFound: string[] = []
        if (enrichmentData.email) fieldsFound.push('email')
        if (enrichmentData.phone) fieldsFound.push('phone')
        if (enrichmentData.website_url) fieldsFound.push('website_url')
        if (enrichmentData.google_review_score !== null && enrichmentData.google_review_score !== undefined) fieldsFound.push('google_review_score')
        if (enrichmentData.google_reviews_link) fieldsFound.push('google_reviews_link')
        if (enrichmentData.time_in_business) fieldsFound.push('time_in_business')
        if (enrichmentData.licensed !== null && enrichmentData.licensed !== undefined) fieldsFound.push('licensed')
        if (enrichmentData.bonded !== null && enrichmentData.bonded !== undefined) fieldsFound.push('bonded')
        if (enrichmentData.notes) fieldsFound.push('notes')
        if (enrichmentData.references) fieldsFound.push('references')
        if (enrichmentData.profile_picture_url) fieldsFound.push('profile_picture_url')

        // Only update if we have data to update
        if (Object.keys(updateData).length === 0) {
          results.push({ 
            id: subcontractor.id, 
            name: subcontractor.name, 
            success: true,
            message: fieldsFound.length > 0 
              ? `Found ${fieldsFound.length} field(s) but no updates needed`
              : 'No new data found',
            fieldsFound,
            fieldsUpdated: [],
          })
          continue
        }

        const fieldsUpdated = Object.keys(updateData)

        // Check if subcontractor exists before updating
        const { data: existingCheck, error: checkError } = await supabase
          .from('subcontractors')
          .select('id')
          .eq('id', subcontractor.id)
          .single()

        if (checkError || !existingCheck) {
          errors.push({ 
            id: subcontractor.id, 
            name: subcontractor.name, 
            error: 'Subcontractor not found',
            fieldsFound,
            fieldsUpdated: [],
          })
          continue
        }

        // Perform the update
        const { error: updateError } = await supabase
          .from('subcontractors')
          .update(updateData)
          .eq('id', subcontractor.id)

        if (updateError) {
          errors.push({ 
            id: subcontractor.id, 
            name: subcontractor.name, 
            error: updateError.message,
            fieldsFound,
            fieldsUpdated: [],
          })
        } else {
          // Update succeeded - try to fetch updated record, but don't fail if fetch fails
          const { data: updated } = await supabase
            .from('subcontractors')
            .select('*')
            .eq('id', subcontractor.id)
            .single()

          results.push({ 
            id: subcontractor.id, 
            name: subcontractor.name, 
            success: true,
            message: `Updated ${fieldsUpdated.length} field(s)`,
            fieldsFound,
            fieldsUpdated,
          })
        }

        // Add delay between requests to avoid rate limiting (except for the last one)
        if (i < subcontractors.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000)) // 2 second delay
        }
      } catch (error) {
        console.error(`Error enriching ${subcontractor.name}:`, error)
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



