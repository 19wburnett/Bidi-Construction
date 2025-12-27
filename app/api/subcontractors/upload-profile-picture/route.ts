import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { downloadImage } from '@/lib/enrichment-image-handler'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST - Upload profile picture (admin only)
 * Accepts either a file upload or imageUrl
 */
export async function POST(request: NextRequest) {
  try {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const imageUrl = formData.get('imageUrl') as string | null
    const subcontractorId = formData.get('subcontractorId') as string | null

    if (!file && !imageUrl) {
      return NextResponse.json({ error: 'Either file or imageUrl is required' }, { status: 400 })
    }

    let fileBuffer: Buffer | null = null
    let contentType: string = 'image/png'
    let fileName: string
    let storagePath: string

    if (file) {
      // Handle file upload
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only JPEG, PNG, WebP, and SVG are allowed.' },
          { status: 400 }
        )
      }

      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size exceeds 5MB limit' },
          { status: 400 }
        )
      }

      fileBuffer = Buffer.from(await file.arrayBuffer())
      contentType = file.type
      const fileExt = file.name.split('.').pop() || 'png'
      fileName = `profile-${uuidv4()}.${fileExt}`
      storagePath = subcontractorId ? `profile/${subcontractorId}/${fileName}` : `profile/${fileName}`
    } else if (imageUrl) {
      // Handle URL upload
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Invalid URL. Must start with http:// or https://' },
          { status: 400 }
        )
      }

      const downloaded = await downloadImage(imageUrl)
      if (!downloaded) {
        return NextResponse.json(
          { error: 'Failed to download image from URL' },
          { status: 400 }
        )
      }

      fileBuffer = downloaded.buffer
      contentType = downloaded.contentType
      const fileExt = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
                      contentType.includes('png') ? 'png' :
                      contentType.includes('webp') ? 'webp' :
                      contentType.includes('svg') ? 'svg' : 'png'
      fileName = `profile-${uuidv4()}.${fileExt}`
      storagePath = subcontractorId ? `profile/${subcontractorId}/${fileName}` : `profile/${fileName}`
    } else {
      return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const supabaseAdmin = createAdminSupabaseClient()
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('subcontractor-assets')
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('subcontractor-assets')
      .getPublicUrl(storagePath)

    if (!urlData?.publicUrl) {
      // Try signed URL as fallback
      const { data: signedData } = await supabaseAdmin.storage
        .from('subcontractor-assets')
        .createSignedUrl(storagePath, 31536000) // 1 year

      if (!signedData?.signedUrl) {
        // Clean up uploaded file
        await supabaseAdmin.storage.from('subcontractor-assets').remove([storagePath])
        return NextResponse.json(
          { error: 'Failed to get public URL' },
          { status: 500 }
        )
      }

      return NextResponse.json({ url: signedData.signedUrl })
    }

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error('Error in POST /api/subcontractors/upload-profile-picture:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload profile picture',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

