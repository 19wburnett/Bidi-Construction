import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path')
    const fileName = searchParams.get('fileName')
    const view = searchParams.get('view') === 'true'

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Log the path for debugging
    console.log('Downloading attachment with path:', path)

    // Download the file from Supabase storage
    const { data, error } = await supabase.storage
      .from('bid-attachments')
      .download(path)

    if (error) {
      console.error('Supabase download error:', error)
      // Extract a clean error message
      let errorMessage = error.message || 'Failed to download file'
      // If error contains a URL (like Supabase sometimes does), extract just the message
      if (errorMessage.includes('http')) {
        errorMessage = 'File not found or access denied. Please check the file path and permissions.'
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get the file's array buffer
    const arrayBuffer = await data.arrayBuffer()

    // Determine content type
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
    const contentType = contentTypes[extension] || 'application/octet-stream'

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

