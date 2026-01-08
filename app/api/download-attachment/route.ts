import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser, createAdminSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path')
    const fileName = searchParams.get('fileName')
    const view = searchParams.get('view') === 'true'

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }

    // Verify user is authenticated
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Log the path for debugging
    console.log('Downloading attachment with path:', path, 'for user:', user.id)

    // First, verify the user has access to this attachment by checking the bid_attachments table
    // Extract the file path components to find the attachment record
    const pathParts = path.split('/')
    const fileNameFromPath = pathParts[pathParts.length - 1]
    
    // Try to find the attachment record to verify access
    // Match by file_path first (most reliable), then fall back to file_name
    const { data: attachmentRecord, error: attachmentError } = await supabase
      .from('bid_attachments')
      .select(`
        id,
        file_path,
        file_name,
        bid_id,
        bids!inner (
          id,
          job_id
        )
      `)
      .or(`file_path.eq.${path},file_name.eq.${fileNameFromPath}`)
      .limit(1)
      .maybeSingle()

    // Handle lookup errors
    if (attachmentError) {
      console.error('Error looking up attachment:', attachmentError)
      return NextResponse.json({ error: 'Failed to verify attachment access' }, { status: 500 })
    }

    // Require attachment record to exist for security
    if (!attachmentRecord) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify the user has access to the job (as owner or collaborator)
    const jobId = (attachmentRecord.bids as any)?.job_id
    if (!jobId) {
      return NextResponse.json({ error: 'Invalid attachment record: missing job_id' }, { status: 400 })
    }

    const jobAccess = await getJobForUser(supabase, jobId, user.id)
    if (!jobAccess) {
      return NextResponse.json({ error: 'Access denied: You do not have access to this job' }, { status: 403 })
    }

    // Use the stored file_path from the attachment record for the download
    // This ensures we use the canonical path that matches what's in storage
    const storagePath = attachmentRecord.file_path || path

    // Use admin client to bypass RLS for storage download
    // We've already verified the user has access to the job above
    const adminSupabase = createAdminSupabaseClient()
    let arrayBuffer: ArrayBuffer
    let contentType = 'application/pdf'
    
    try {
      // Try direct download first with admin client (bypasses RLS)
      const { data, error } = await adminSupabase.storage
        .from('bid-attachments')
        .download(storagePath)

      if (error) {
        console.error('Supabase download error:', error)
        // If direct download fails, try signed URL as fallback
        const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
          .from('bid-attachments')
          .createSignedUrl(storagePath, 60) // 60 seconds validity

        if (!signedUrlError && signedUrlData?.signedUrl) {
          // Fetch the file using the signed URL
          const fileResponse = await fetch(signedUrlData.signedUrl)
          if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file: ${fileResponse.statusText}`)
          }
          arrayBuffer = await fileResponse.arrayBuffer()
          // Try to get content type from response
          const responseContentType = fileResponse.headers.get('content-type')
          if (responseContentType) {
            contentType = responseContentType
          }
        } else {
          let errorMessage = error.message || 'Failed to download file'
          if (errorMessage.includes('http') || errorMessage.includes('Access denied')) {
            errorMessage = 'File not found or access denied. Please check the file path and permissions.'
          }
          return NextResponse.json({ error: errorMessage }, { status: 500 })
        }
      } else {
        if (!data) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }
        arrayBuffer = await data.arrayBuffer()
      }
    } catch (fetchError: any) {
      console.error('Error fetching file:', fetchError)
      return NextResponse.json({ 
        error: fetchError.message || 'Failed to download file' 
      }, { status: 500 })
    }

    // Determine content type if not already set from response
    if (contentType === 'application/pdf') {
      const extension = path.split('.').pop()?.toLowerCase() || ''
      const contentTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        txt: 'text/plain',
        csv: 'text/csv',
      }
      contentType = contentTypes[extension] || 'application/octet-stream'
    }

    // Set Content-Disposition based on view mode
    // 'inline' allows viewing in browser/iframe, 'attachment' forces download
    // Properly encode filename for Safari/Mac compatibility
    const safeFileName = fileName || 'download'
    const encodedFileName = encodeURIComponent(safeFileName)
    
    const contentDisposition = view
      ? `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`
      : `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`

    // Create response with proper headers
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
      'Content-Length': arrayBuffer.byteLength.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    }

    // Add CORS headers for iframe embedding (important for Safari/Mac)
    if (view) {
      headers['Access-Control-Allow-Origin'] = '*'
      headers['Access-Control-Allow-Methods'] = 'GET'
      headers['Access-Control-Allow-Headers'] = 'Content-Type'
    }

    const response = new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    })

    return response
  } catch (err: any) {
    console.error('Download attachment error:', err)
    return NextResponse.json({ error: err.message || 'Download failed' }, { status: 500 })
  }
}

