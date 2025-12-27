import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { downloadImage } from '@/lib/enrichment-image-handler'
import { v4 as uuidv4 } from 'uuid'

/**
 * GET - Fetch all photos for a subcontractor (public)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Fetch all photos for this subcontractor, ordered by display_order then created_at
    const { data: photos, error } = await supabase
      .from('subcontractor_portfolio_photos')
      .select('*')
      .eq('subcontractor_id', id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching portfolio photos:', error)
      return NextResponse.json(
        { error: 'Failed to fetch photos', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ photos: photos || [] })
  } catch (error) {
    console.error('Error in GET /api/subcontractors/[id]/photos:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch photos',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Upload new photo (admin or subcontractor auth required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
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

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const imageUrl = formData.get('imageUrl') as string | null
    const caption = formData.get('caption') as string | null
    const isPrimary = formData.get('isPrimary') === 'true' || formData.get('is_primary') === 'true'
    const displayOrder = formData.get('display_order') ? parseInt(formData.get('display_order') as string) : 0

    if (!file && !imageUrl) {
      return NextResponse.json({ error: 'Either file or imageUrl is required' }, { status: 400 })
    }

    let fileBuffer: Buffer | null = null
    let contentType: string = 'image/png'
    let fileName: string
    let storagePath: string

    if (file) {
      // Handle file upload
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
          { status: 400 }
        )
      }

      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size exceeds 10MB limit' },
          { status: 400 }
        )
      }

      fileBuffer = Buffer.from(await file.arrayBuffer())
      contentType = file.type
      const fileExt = file.name.split('.').pop() || 'png'
      fileName = `${uuidv4()}.${fileExt}`
      storagePath = `portfolio/${id}/${fileName}`
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
                      contentType.includes('webp') ? 'webp' : 'png'
      fileName = `${uuidv4()}.${fileExt}`
      storagePath = `portfolio/${id}/${fileName}`
    } else {
      return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 })
    }

    // Check current photo count (max 50)
    const supabaseAdmin = createAdminSupabaseClient()
    const { count } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .select('*', { count: 'exact', head: true })
      .eq('subcontractor_id', id)

    if ((count || 0) >= 50) {
      return NextResponse.json(
        { error: 'Maximum of 50 photos per subcontractor' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
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

      // Insert photo record
      const { data: photo, error: insertError } = await supabaseAdmin
        .from('subcontractor_portfolio_photos')
        .insert({
          subcontractor_id: id,
          image_url: signedData.signedUrl,
          storage_path: storagePath,
          caption: caption || null,
          display_order: displayOrder,
          is_primary: isPrimary,
          uploaded_by: authUser.id,
        })
        .select()
        .single()

      if (insertError) {
        // Clean up uploaded file
        await supabaseAdmin.storage.from('subcontractor-assets').remove([storagePath])
        return NextResponse.json(
          { error: 'Failed to save photo record', details: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ photo })
    }

    // Insert photo record with public URL
    const { data: photo, error: insertError } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .insert({
        subcontractor_id: id,
        image_url: urlData.publicUrl,
        storage_path: storagePath,
        caption: caption || null,
        display_order: displayOrder,
        is_primary: isPrimary,
        uploaded_by: authUser.id,
      })
      .select()
      .single()

    if (insertError) {
      // Clean up uploaded file
      await supabaseAdmin.storage.from('subcontractor-assets').remove([storagePath])
      return NextResponse.json(
        { error: 'Failed to save photo record', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ photo })
  } catch (error) {
    console.error('Error in POST /api/subcontractors/[id]/photos:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload photo',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete all photos for a subcontractor (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
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

    const supabaseAdmin = createAdminSupabaseClient()

    // Fetch all photos to get storage paths
    const { data: photos, error: fetchError } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .select('storage_path')
      .eq('subcontractor_id', id)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch photos', details: fetchError.message },
        { status: 500 }
      )
    }

    // Delete from storage
    if (photos && photos.length > 0) {
      const paths = photos.map(p => p.storage_path).filter(Boolean)
      if (paths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from('subcontractor-assets')
          .remove(paths)

        if (storageError) {
          console.error('Error deleting files from storage:', storageError)
          // Continue with database deletion even if storage deletion fails
        }
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .delete()
      .eq('subcontractor_id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete photos', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, deleted: photos?.length || 0 })
  } catch (error) {
    console.error('Error in DELETE /api/subcontractors/[id]/photos:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete photos',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

