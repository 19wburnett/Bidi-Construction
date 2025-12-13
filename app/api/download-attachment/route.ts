import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

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
    const { data: attachmentRecord, error: attachmentError } = await supabase
      .from('bid_attachments')
      .select(`
        id,
        file_path,
        file_name,
        bid_id,
        bids!inner (
          id,
          job_id,
          jobs!inner (
            id,
            user_id
          )
        )
      `)
      .or(`file_path.eq.${path},file_name.eq.${fileNameFromPath}`)
      .limit(1)
      .maybeSingle()

    // If we found the record, verify the user owns the job
    if (attachmentRecord) {
      const jobUserId = (attachmentRecord.bids as any)?.jobs?.user_id
      if (jobUserId !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Try to download using signed URL first (respects RLS better)
    // If that fails, fall back to direct download
    let arrayBuffer: ArrayBuffer
    let contentType = 'application/pdf'
    
    try {
      // First, try to create a signed URL (this respects RLS policies)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('bid-attachments')
        .createSignedUrl(path, 60) // 60 seconds validity

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
        // Fall back to direct download
        console.log('Signed URL failed, trying direct download:', signedUrlError?.message)
        const { data, error } = await supabase.storage
          .from('bid-attachments')
          .download(path)

        if (error) {
          console.error('Supabase download error:', error)
          let errorMessage = error.message || 'Failed to download file'
          if (errorMessage.includes('http')) {
            errorMessage = 'File not found or access denied. Please check the file path and permissions.'
          }
          return NextResponse.json({ error: errorMessage }, { status: 500 })
        }

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

