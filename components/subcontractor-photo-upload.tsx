'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, X, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

interface SubcontractorPhotoUploadProps {
  subcontractorId: string
  onUploadSuccess?: () => void
  onUploadError?: (error: string) => void
}

interface FilePreview {
  id: string
  file?: File
  url?: string
  preview: string
  caption: string
  isPrimary: boolean
  displayOrder: number
  uploading?: boolean
  uploaded?: boolean
  error?: string
}

export default function SubcontractorPhotoUpload({
  subcontractorId,
  onUploadSuccess,
  onUploadError,
}: SubcontractorPhotoUploadProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<FilePreview[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(Array.from(e.dataTransfer.files))
    }
  }, [])

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return 'File size exceeds 10MB limit'
    }

    return null
  }

  const handleFilesSelect = (selectedFiles: File[]) => {
    const newFiles: FilePreview[] = []
    const errors: string[] = []

    selectedFiles.forEach((file, index) => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
        return
      }

      const id = `${Date.now()}-${index}-${Math.random()}`
      const reader = new FileReader()
      reader.onload = (e) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, preview: e.target?.result as string } : f
          )
        )
      }
      reader.readAsDataURL(file)

      newFiles.push({
        id,
        file,
        preview: '',
        caption: '',
        isPrimary: false,
        displayOrder: files.length + newFiles.length,
      })
    })

    if (errors.length > 0) {
      onUploadError?.(errors.join('\n'))
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelect(Array.from(e.target.files))
    }
  }

  const handleUrlChange = (url: string) => {
    setImageUrl(url)
  }

  const handleAddUrl = () => {
    if (!imageUrl.trim() || !(imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      onUploadError?.('Please enter a valid image URL')
      return
    }

    const id = `url-${Date.now()}-${Math.random()}`
    setFiles((prev) => [
      ...prev,
      {
        id,
        url: imageUrl.trim(),
        preview: imageUrl.trim(),
        caption: '',
        isPrimary: false,
        displayOrder: prev.length,
      },
    ])
    setImageUrl('')
  }

  const updateFile = (id: string, updates: Partial<FilePreview>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      onUploadError?.('Please select at least one photo to upload')
      return
    }

    setUploading(true)
    const uploadResults: { success: boolean; id: string }[] = []

    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < files.length; i++) {
      const filePreview = files[i]
      
      if (filePreview.uploaded) continue

      updateFile(filePreview.id, { uploading: true, error: undefined })

      try {
        const formData = new FormData()

        if (filePreview.file) {
          formData.append('image', filePreview.file)
        } else if (filePreview.url) {
          formData.append('imageUrl', filePreview.url)
        } else {
          updateFile(filePreview.id, { uploading: false, error: 'No file or URL provided' })
          continue
        }

        if (filePreview.caption) formData.append('caption', filePreview.caption)
        formData.append('isPrimary', filePreview.isPrimary.toString())
        formData.append('display_order', filePreview.displayOrder.toString())

        const response = await fetch(`/api/subcontractors/${subcontractorId}/photos`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to upload photo')
        }

        updateFile(filePreview.id, { uploading: false, uploaded: true })
        uploadResults.push({ success: true, id: filePreview.id })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload photo'
        updateFile(filePreview.id, { uploading: false, error: errorMessage })
        uploadResults.push({ success: false, id: filePreview.id })
        onUploadError?.(`Failed to upload ${filePreview.file?.name || 'photo'}: ${errorMessage}`)
      }
    }

    setUploading(false)

    // If all uploads succeeded, reset and call success callback
    const allSucceeded = uploadResults.every((r) => r.success)
    if (allSucceeded && uploadResults.length > 0) {
      setTimeout(() => {
        setFiles([])
        setImageUrl('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        onUploadSuccess?.()
      }, 1000) // Give users a moment to see the success state
    }
  }

  const handleRemoveAll = () => {
    setFiles([])
    setImageUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const hasUnuploadedFiles = files.some((f) => !f.uploaded)
  const allUploaded = files.length > 0 && files.every((f) => f.uploaded)

  return (
    <div className="space-y-4">
      {/* Upload Mode Toggle */}
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
          disabled={uploading}
        >
          Upload Files
        </Button>
        <Button
          type="button"
          variant={uploadMode === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setUploadMode('url')
            if (uploadMode === 'file') {
              handleRemoveAll()
            }
          }}
          disabled={uploading}
        >
          Add from URL
        </Button>
      </div>

      {uploadMode === 'file' ? (
        <>
          {files.length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700 mb-2">
                Drag and drop images here, or click to select
              </p>
              <p className="text-xs text-gray-500 mb-4">
                JPEG, PNG, or WebP (max 10MB each). You can select multiple files.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Select Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {files.length} photo{files.length !== 1 ? 's' : ''} selected
                  {allUploaded && <span className="text-green-600 ml-2">✓ All uploaded!</span>}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAll}
                  disabled={uploading}
                >
                  Clear All
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {files.map((filePreview) => (
                  <div key={filePreview.id} className="relative group border rounded-lg overflow-hidden">
                    <div className="aspect-video relative bg-gray-100">
                      {filePreview.preview && (
                        <Image
                          src={filePreview.preview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      )}
                      {filePreview.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                      {filePreview.uploaded && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                      )}
                      {filePreview.error && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <X className="h-6 w-6 text-red-600" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(filePreview.id)}
                        disabled={uploading || filePreview.uploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {filePreview.error && (
                      <p className="text-xs text-red-600 p-1 truncate" title={filePreview.error}>
                        {filePreview.error}
                      </p>
                    )}
                    <div className="p-2 space-y-1">
                      <Input
                        placeholder="Caption (optional)"
                        value={filePreview.caption}
                        onChange={(e) => updateFile(filePreview.id, { caption: e.target.value })}
                        disabled={uploading || filePreview.uploading}
                        className="text-xs h-7"
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={filePreview.isPrimary}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              // Unset all other primary flags
                              setFiles((prev) =>
                                prev.map((f) => ({
                                  ...f,
                                  isPrimary: f.id === filePreview.id,
                                }))
                              )
                            } else {
                              updateFile(filePreview.id, { isPrimary: false })
                            }
                          }}
                          disabled={uploading || filePreview.uploading}
                        />
                        <Label className="text-xs cursor-pointer">Primary</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !hasUnuploadedFiles}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {files.filter((f) => !f.uploaded).length} Photo{files.filter((f) => !f.uploaded).length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Add More
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/image.jpg"
                disabled={uploading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddUrl()
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddUrl}
                disabled={uploading || !imageUrl.trim()}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Enter a direct link to an image (JPEG, PNG, or WebP). Press Enter or click Add.
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {files.length} URL{files.length !== 1 ? 's' : ''} added
                  {allUploaded && <span className="text-green-600 ml-2">✓ All uploaded!</span>}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAll}
                  disabled={uploading}
                >
                  Clear All
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {files.map((filePreview) => (
                  <div key={filePreview.id} className="relative group border rounded-lg overflow-hidden">
                    <div className="aspect-video relative bg-gray-100">
                      {filePreview.preview && (
                        <Image
                          src={filePreview.preview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      )}
                      {filePreview.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                      {filePreview.uploaded && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                      )}
                      {filePreview.error && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <X className="h-6 w-6 text-red-600" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(filePreview.id)}
                        disabled={uploading || filePreview.uploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {filePreview.error && (
                      <p className="text-xs text-red-600 p-1 truncate" title={filePreview.error}>
                        {filePreview.error}
                      </p>
                    )}
                    <div className="p-2 space-y-1">
                      <Input
                        placeholder="Caption (optional)"
                        value={filePreview.caption}
                        onChange={(e) => updateFile(filePreview.id, { caption: e.target.value })}
                        disabled={uploading || filePreview.uploading}
                        className="text-xs h-7"
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={filePreview.isPrimary}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              // Unset all other primary flags
                              setFiles((prev) =>
                                prev.map((f) => ({
                                  ...f,
                                  isPrimary: f.id === filePreview.id,
                                }))
                              )
                            } else {
                              updateFile(filePreview.id, { isPrimary: false })
                            }
                          }}
                          disabled={uploading || filePreview.uploading}
                        />
                        <Label className="text-xs cursor-pointer">Primary</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !hasUnuploadedFiles}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {files.filter((f) => !f.uploaded).length} Photo{files.filter((f) => !f.uploaded).length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
