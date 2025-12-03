import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path')
    const fileName = searchParams.get('fileName')

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

    // Create response with proper headers to force download
    const response = new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName || 'download'}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })

    return response
  } catch (err: any) {
    console.error('Download attachment error:', err)
    return NextResponse.json({ error: err.message || 'Download failed' }, { status: 500 })
  }
}

