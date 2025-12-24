/**
 * Enrichment Image Handler
 * 
 * Downloads images from URLs and uploads to Supabase Storage
 * Used for subcontractor profile pictures/logos
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'

const STORAGE_BUCKET = 'subcontractor-assets'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon']

/**
 * User agent for image downloads
 */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Result of image upload
 */
export interface ImageUploadResult {
  success: boolean
  publicUrl?: string
  error?: string
}

/**
 * Download an image from a URL
 */
export async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.warn(`Failed to download image from ${imageUrl}: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    
    // Check content type
    const isImage = ALLOWED_CONTENT_TYPES.some(type => contentType.includes(type.split('/')[1]))
    if (!isImage && !contentType.includes('image')) {
      console.warn(`Invalid content type for image: ${contentType}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check size
    if (buffer.length > MAX_IMAGE_SIZE) {
      console.warn(`Image too large: ${buffer.length} bytes`)
      return null
    }

    if (buffer.length < 100) {
      console.warn(`Image too small, likely invalid: ${buffer.length} bytes`)
      return null
    }

    return { buffer, contentType }
  } catch (error) {
    console.error(`Error downloading image from ${imageUrl}:`, error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  }
  
  for (const [type, ext] of Object.entries(typeMap)) {
    if (contentType.includes(type.split('/')[1])) {
      return ext
    }
  }
  
  return 'png' // Default
}

/**
 * Upload an image to Supabase Storage
 */
export async function uploadImageToStorage(
  subcontractorId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<ImageUploadResult> {
  try {
    const supabase = await createServerSupabaseClient()
    
    const extension = getExtensionFromContentType(contentType)
    const fileName = `${subcontractorId}/logo.${extension}`
    
    // Upload to storage
    const { data, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: true, // Overwrite if exists
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return {
        success: false,
        error: uploadError.message,
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      // Try signed URL as fallback
      const { data: signedData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(fileName, 31536000) // 1 year

      if (signedData?.signedUrl) {
        return {
          success: true,
          publicUrl: signedData.signedUrl,
        }
      }

      return {
        success: false,
        error: 'Failed to get public URL',
      }
    }

    return {
      success: true,
      publicUrl: urlData.publicUrl,
    }
  } catch (error) {
    console.error('Error uploading image to storage:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Download image from URL and upload to Supabase Storage
 */
export async function downloadAndUploadImage(
  subcontractorId: string,
  imageUrl: string
): Promise<ImageUploadResult> {
  console.log(`📥 Downloading image: ${imageUrl}`)
  
  // Download the image
  const downloaded = await downloadImage(imageUrl)
  
  if (!downloaded) {
    return {
      success: false,
      error: 'Failed to download image',
    }
  }

  console.log(`📤 Uploading image to storage (${downloaded.buffer.length} bytes)`)
  
  // Upload to storage
  const result = await uploadImageToStorage(
    subcontractorId,
    downloaded.buffer,
    downloaded.contentType
  )

  if (result.success) {
    console.log(`✅ Image uploaded: ${result.publicUrl}`)
  } else {
    console.error(`❌ Image upload failed: ${result.error}`)
  }

  return result
}

/**
 * Ensure the storage bucket exists
 * Call this during app initialization if needed
 */
export async function ensureStorageBucketExists(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return false
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET)
    
    if (!bucketExists) {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        allowedMimeTypes: ALLOWED_CONTENT_TYPES,
        fileSizeLimit: MAX_IMAGE_SIZE,
      })

      if (createError) {
        console.error('Error creating bucket:', createError)
        return false
      }

      console.log(`Created storage bucket: ${STORAGE_BUCKET}`)
    }

    return true
  } catch (error) {
    console.error('Error ensuring bucket exists:', error)
    return false
  }
}

