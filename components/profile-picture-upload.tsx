'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, Loader2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react'
import Image from 'next/image'

interface ProfilePictureUploadProps {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  subcontractorId?: string
}

export default function ProfilePictureUpload({
  value,
  onChange,
  disabled = false,
  subcontractorId,
}: ProfilePictureUploadProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('url')
  const [preview, setPreview] = useState<string | null>(value || null)
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(selectedFile.type)) {
      alert('Invalid file type. Only JPEG, PNG, WebP, and SVG are allowed.')
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (selectedFile.size > maxSize) {
      alert('File size exceeds 5MB limit')
      return
    }

    setFile(selectedFile)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)

    // Auto-upload the file
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (subcontractorId) {
        formData.append('subcontractorId', subcontractorId)
      }

      const response = await fetch('/api/subcontractors/upload-profile-picture', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload profile picture')
      }

      const data = await response.json()
      console.log('Profile picture uploaded, URL:', data.url)
      onChange(data.url)
      setPreview(data.url)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload profile picture'
      alert(errorMessage)
      // Keep the file selected so user can try again
    } finally {
      setUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (uploadMode === 'file' && !file) return
    if (uploadMode === 'url' && !imageUrl.trim()) {
      alert('Please enter a valid image URL')
      return
    }

    setUploading(true)

    try {
      if (uploadMode === 'file' && file) {
        // Upload file to API endpoint
        const formData = new FormData()
        formData.append('file', file)
        if (subcontractorId) {
          formData.append('subcontractorId', subcontractorId)
        }

        const response = await fetch('/api/subcontractors/upload-profile-picture', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to upload profile picture')
        }

        const data = await response.json()
        onChange(data.url)
        setPreview(data.url)
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else if (uploadMode === 'url' && imageUrl) {
        // Just use the URL directly
        onChange(imageUrl.trim())
        setImageUrl('')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload profile picture'
      alert(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setFile(null)
    setImageUrl('')
    setPreview(null)
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Update preview when value changes externally
  if (value && preview !== value) {
    setPreview(value)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-3">
        <Button
          type="button"
          variant={uploadMode === 'file' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setUploadMode('file')
            if (uploadMode === 'url') {
              setImageUrl('')
            }
          }}
          disabled={uploading || disabled}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload File
        </Button>
        <Button
          type="button"
          variant={uploadMode === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setUploadMode('url')
            if (uploadMode === 'file') {
              setFile(null)
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }
          }}
          disabled={uploading || disabled}
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Use URL
        </Button>
      </div>

      {(preview || file) && (
        <div className="space-y-3">
          <div className="relative inline-block">
            <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200 relative bg-gray-100">
              <Image
                src={preview || (file ? URL.createObjectURL(file) : '')}
                alt="Profile picture"
                fill
                className="object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2"
              onClick={handleRemove}
              disabled={uploading || disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {!preview && !file && (
        <>
          {uploadMode === 'file' ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">Upload profile picture</p>
              <p className="text-xs text-gray-500 mb-3">JPEG, PNG, WebP, or SVG (max 5MB)</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || disabled}
              >
                <Upload className="h-4 w-4 mr-2" />
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="profilePictureUrl">Profile Picture URL</Label>
              <div className="flex gap-2">
                <Input
                  id="profilePictureUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled={uploading || disabled}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleUpload()
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || disabled || !imageUrl.trim()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Set'
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Enter a direct link to the profile picture/logo
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

