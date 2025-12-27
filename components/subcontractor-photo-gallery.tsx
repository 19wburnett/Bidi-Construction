'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, Upload } from 'lucide-react'
import SubcontractorPhotoUpload from './subcontractor-photo-upload'

interface PortfolioPhoto {
  id: string
  image_url: string
  caption: string | null
  is_primary: boolean
  display_order: number
}

interface SubcontractorPhotoGalleryProps {
  photos: PortfolioPhoto[]
  subcontractorId: string
  canUpload?: boolean
  onUploadSuccess?: () => void
}

export default function SubcontractorPhotoGallery({
  photos,
  subcontractorId,
  canUpload = false,
  onUploadSuccess,
}: SubcontractorPhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Sort photos: primary first, then by display_order
  const sortedPhotos = [...photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return a.display_order - b.display_order
  })

  const primaryPhoto = sortedPhotos.find(p => p.is_primary) || sortedPhotos[0]
  const otherPhotos = sortedPhotos.filter(p => p.id !== primaryPhoto?.id).slice(0, 4) // Show max 5 total

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setLightboxIndex((prev) => (prev > 0 ? prev - 1 : sortedPhotos.length - 1))
    } else {
      setLightboxIndex((prev) => (prev < sortedPhotos.length - 1 ? prev + 1 : 0))
    }
  }

  const handleUploadSuccess = () => {
    setUploadModalOpen(false)
    onUploadSuccess?.()
  }

  if (photos.length === 0 && !canUpload) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">No photos available</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Primary photo and grid */}
        {primaryPhoto ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Primary photo - takes up 2x2 on desktop */}
            <div
              className="col-span-2 row-span-2 cursor-pointer group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
              onClick={() => openLightbox(0)}
            >
              <div className="aspect-[4/3] md:aspect-square relative bg-gray-100">
                <Image
                  src={primaryPhoto.image_url}
                  alt={primaryPhoto.caption || 'Primary photo'}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <p className="text-white text-sm font-medium truncate">{primaryPhoto.caption || 'Project View'}</p>
                </div>
              </div>
            </div>

            {/* Other photos grid */}
            {otherPhotos.map((photo, idx) => (
              <div
                key={photo.id}
                className="cursor-pointer group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                onClick={() => openLightbox(idx + 1)}
              >
                <div className="aspect-square relative bg-gray-100">
                  <Image
                    src={photo.image_url}
                    alt={photo.caption || `Photo ${idx + 2}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Show more button if there are more photos */}
            {sortedPhotos.length > 5 && (
              <div
                className="cursor-pointer group relative rounded-xl overflow-hidden bg-gray-900 text-white flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300"
                onClick={() => openLightbox(5)}
              >
                <div className="absolute inset-0 bg-orange-600 opacity-0 group-hover:opacity-20 transition-opacity" />
                <div className="text-center p-4 z-10">
                  <p className="text-2xl font-bold">+{sortedPhotos.length - 5}</p>
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Gallery</p>
                </div>
              </div>
            )}

            {/* Upload button if can upload */}
            {canUpload && (
              <div
                className="cursor-pointer group relative rounded-xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-orange-500 hover:bg-orange-50/30 flex items-center justify-center transition-all duration-300"
                onClick={() => setUploadModalOpen(true)}
              >
                <div className="text-center p-4">
                  <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-2 group-hover:bg-orange-100 transition-colors">
                    <Upload className="h-5 w-5 text-gray-400 group-hover:text-orange-600" />
                  </div>
                  <p className="text-xs font-bold text-gray-500 group-hover:text-orange-700 uppercase tracking-tight">
                    Add Photo
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : canUpload ? (
          <div
            className="cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-orange-500 hover:bg-orange-50/30 bg-white transition-all duration-300"
            onClick={() => setUploadModalOpen(true)}
          >
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-100 transition-colors">
              <Upload className="h-8 w-8 text-gray-400 group-hover:text-orange-600" />
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">Portfolio empty</p>
            <p className="text-sm text-gray-500">Upload your first project photo to showcase your work.</p>
          </div>
        ) : null}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Previous button */}
            {sortedPhotos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 z-50 text-white hover:bg-white/20"
                onClick={() => navigateLightbox('prev')}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* Image */}
            {sortedPhotos[lightboxIndex] && (
              <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <div className="relative w-full h-full max-w-6xl">
                  <Image
                    src={sortedPhotos[lightboxIndex].image_url}
                    alt={sortedPhotos[lightboxIndex].caption || `Photo ${lightboxIndex + 1}`}
                    fill
                    className="object-contain"
                  />
                </div>
                {sortedPhotos[lightboxIndex].caption && (
                  <p className="text-white mt-4 text-center max-w-2xl">
                    {sortedPhotos[lightboxIndex].caption}
                  </p>
                )}
                <p className="text-white/60 mt-2 text-sm">
                  {lightboxIndex + 1} of {sortedPhotos.length}
                </p>
              </div>
            )}

            {/* Next button */}
            {sortedPhotos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 z-50 text-white hover:bg-white/20"
                onClick={() => navigateLightbox('next')}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      {canUpload && (
        <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
          <DialogContent className="max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Upload Photo</h2>
            <SubcontractorPhotoUpload
              subcontractorId={subcontractorId}
              onUploadSuccess={handleUploadSuccess}
              onUploadError={(error) => {
                alert(error)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

