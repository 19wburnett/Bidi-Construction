import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { extractCostCodesFromDocument } from '@/lib/cost-codes/extract-custom-cost-codes'

/**
 * POST /api/cost-codes/upload
 * Upload a cost code document (PDF or Excel) and extract cost codes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Missing required field: file' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    const validExtensions = ['pdf', 'xlsx', 'xls', 'csv']
    if (!fileExt || !validExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: `Invalid file type. Supported formats: ${validExtensions.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Determine file type
    const fileType = fileExt === 'pdf' ? 'pdf' : 'excel'

    // Upload file to storage
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const storageFileName = `${timestamp}_${randomStr}.${fileExt}`
    const filePath = `cost-codes/${user.id}/${storageFileName}`

    const { error: uploadError } = await supabase.storage
      .from('bid-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create database record with pending status
    const costCodeName = name || file.name.split('.')[0] || 'Custom Cost Codes'
    
    const { data: costCodeSet, error: insertError } = await supabase
      .from('custom_cost_codes')
      .insert({
        user_id: user.id,
        name: costCodeName,
        file_name: file.name,
        file_path: filePath,
        file_type: fileType,
        extraction_status: 'processing',
        cost_codes: []
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating cost code record:', insertError)
      // Try to clean up uploaded file
      await supabase.storage
        .from('bid-documents')
        .remove([filePath])
      
      return NextResponse.json(
        { error: 'Failed to create cost code record' },
        { status: 500 }
      )
    }

    // Process extraction asynchronously (don't wait for it)
    processExtraction(supabase, costCodeSet.id, filePath, fileType, file.name)
      .catch(async (error) => {
        console.error('[Cost Code Upload] Extraction failed:', error)
        // Update status to failed
        try {
          const { error: updateError } = await supabase
            .from('custom_cost_codes')
            .update({
              extraction_status: 'failed',
              extraction_error: error.message || 'Unknown error during extraction'
            })
            .eq('id', costCodeSet.id)
          
          if (updateError) {
            console.error('[Cost Code Upload] Failed to update error status:', updateError)
          }
        } catch (updateError) {
          console.error('[Cost Code Upload] Failed to update error status:', updateError)
        }
      })

    return NextResponse.json({
      success: true,
      costCodeSet: {
        id: costCodeSet.id,
        name: costCodeSet.name,
        file_name: costCodeSet.file_name,
        extraction_status: costCodeSet.extraction_status,
        created_at: costCodeSet.created_at
      }
    })
  } catch (error: any) {
    console.error('Error in POST /api/cost-codes/upload:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Process cost code extraction asynchronously
 */
async function processExtraction(
  supabase: any,
  costCodeSetId: string,
  filePath: string,
  fileType: 'pdf' | 'excel',
  fileName: string
) {
  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bid-documents')
      .download(filePath)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`)
    }

    // Convert to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract cost codes
    const costCodes = await extractCostCodesFromDocument(buffer, fileType, fileName)

    if (!costCodes || costCodes.length === 0) {
      throw new Error('No cost codes found in document')
    }

    // Update database record with extracted codes
    const { error: updateError } = await supabase
      .from('custom_cost_codes')
      .update({
        extraction_status: 'completed',
        cost_codes: costCodes,
        updated_at: new Date().toISOString()
      })
      .eq('id', costCodeSetId)

    if (updateError) {
      throw new Error(`Failed to update cost codes: ${updateError.message}`)
    }

    console.log(`[Cost Code Upload] Successfully extracted ${costCodes.length} cost codes for set ${costCodeSetId}`)
  } catch (error: any) {
    console.error('[Cost Code Upload] Extraction error:', error)
    throw error
  }
}
