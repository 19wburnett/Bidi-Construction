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

    // Download the file from Supabase storage
    const { data, error } = await supabase.storage
      .from('bid-attachments')
      .download(path)

    if (error) {
      console.error('Supabase download error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    const contentDisposition = view
      ? `inline; filename="${fileName || 'download'}"`
      : `attachment; filename="${fileName || 'download'}"`

    // Create response with proper headers
    const response = new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        // Add CORS headers for iframe embedding
        'X-Content-Type-Options': 'nosniff',
      },
    })

    return response
  } catch (err: any) {
    console.error('Download attachment error:', err)
    return NextResponse.json({ error: err.message || 'Download failed' }, { status: 500 })
  }
}

