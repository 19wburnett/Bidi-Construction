'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Star, Loader2, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import SubcontractorPhotoUpload from './subcontractor-photo-upload'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PortfolioPhoto {
  id: string
  image_url: string
  caption: string | null
  is_primary: boolean
  display_order: number
  created_at: string
}

interface SubcontractorPhotoManagerProps {
  subcontractorId: string
  isOpen: boolean
  onClose: () => void
}

export default function SubcontractorPhotoManager({
  subcontractorId,
  isOpen,
  onClose,
}: SubcontractorPhotoManagerProps) {
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && subcontractorId) {
      fetchPhotos()
    }
  }, [isOpen, subcontractorId])

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/subcontractors/${subcontractorId}/photos`)
      
      if (!response.ok) {
        throw new Error('Failed to load photos')
      }

      const data = await response.json()
      setPhotos(data.photos || [])
    } catch (err) {
      console.error('Error fetching photos:', err)
      setError('Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    try {
      setDeleting(photoId)
      const response = await fetch(`/api/subcontractors/${subcontractorId}/photos/${photoId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete photo')
      }

      await fetchPhotos()
    } catch (err) {
      console.error('Error deleting photo:', err)
      alert('Failed to delete photo')
    } finally {
      setDeleting(null)
    }
  }

  const handleSetPrimary = async (photoId: string) => {
    try {
      const response = await fetch(`/api/subcontractors/${subcontractorId}/photos/${photoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_primary: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to set primary photo')
      }

      await fetchPhotos()
    } catch (err) {
      console.error('Error setting primary photo:', err)
      alert('Failed to set primary photo')
    }
  }

  const sortedPhotos = [...photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return a.display_order - b.display_order
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Manage Portfolio Photos</DialogTitle>
            <DialogClose onClick={onClose} />
          </div>
        </DialogHeader>

        <Tabs defaultValue="gallery" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="gallery">Gallery ({photos.length})</TabsTrigger>
              <TabsTrigger value="upload">Add Photo</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="gallery" className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">{error}</div>
            ) : sortedPhotos.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-2">No photos yet</p>
                <p className="text-sm text-gray-500">Add photos using the "Add Photo" tab</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {sortedPhotos.map((photo) => (
                  <div key={photo.id} className="relative group border rounded-lg overflow-hidden">
                    <div className="aspect-video relative bg-gray-100">
                      <Image
                        src={photo.image_url}
                        alt={photo.caption || 'Portfolio photo'}
                        fill
                        className="object-cover"
                      />
                      {photo.is_primary && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-orange-500 text-white">
                            <Star className="h-3 w-3 mr-1 fill-white" />
                            Primary
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white">
                      {photo.caption && (
                        <p className="text-xs text-gray-600 mb-2 truncate" title={photo.caption}>
                          {photo.caption}
                        </p>
                      )}
                      <div className="flex gap-2">
                        {!photo.is_primary && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => handleSetPrimary(photo.id)}
                            disabled={deleting === photo.id}
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Set Primary
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 text-xs"
                          onClick={() => handleDelete(photo.id)}
                          disabled={deleting === photo.id}
                        >
                          {deleting === photo.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 mr-1" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="flex-1 overflow-y-auto px-6 py-4">
            <SubcontractorPhotoUpload
              subcontractorId={subcontractorId}
              onUploadSuccess={() => {
                fetchPhotos()
                // Optionally switch to gallery tab after upload
              }}
              onUploadError={(error) => {
                alert(error)
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

