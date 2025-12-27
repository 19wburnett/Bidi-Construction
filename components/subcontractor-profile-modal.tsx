'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, X } from 'lucide-react'
import SubcontractorProfileHeader from './subcontractor-profile-header'
import SubcontractorPhotoGallery from './subcontractor-photo-gallery'
import SubcontractorProfileInfoCard from './subcontractor-profile-info-card'
import SubcontractorLocationMap from './subcontractor-location-map'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

interface PortfolioPhoto {
  id: string
  image_url: string
  caption: string | null
  is_primary: boolean
  display_order: number
}

interface Subcontractor {
  id: string
  name: string
  email: string
  trade_category: string
  location: string
  phone?: string | null
  website_url?: string | null
  google_review_score?: number | null
  google_reviews_link?: string | null
  time_in_business?: string | null
  jobs_completed?: number | null
  licensed?: boolean | null
  bonded?: boolean | null
  profile_picture_url?: string | null
  profile_summary?: string | null
  services?: string[] | null
  bio?: string | null
  service_radius?: number | null
  year_established?: number | null
}

interface SubcontractorProfileModalProps {
  subcontractorId: string
  isOpen: boolean
  onClose: () => void
}

export default function SubcontractorProfileModal({
  subcontractorId,
  isOpen,
  onClose,
}: SubcontractorProfileModalProps) {
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null)
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !subcontractorId) return

    const fetchProfile = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/subcontractors/${subcontractorId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Subcontractor not found')
          } else {
            const data = await response.json()
            setError(data.error || 'Failed to load profile')
          }
          return
        }

        const data = await response.json()
        setSubcontractor(data.subcontractor)
        setPhotos(data.photos || [])
      } catch (err) {
        console.error('Error fetching profile:', err)
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [isOpen, subcontractorId])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSubcontractor(null)
      setPhotos([])
      setError(null)
      setLoading(true)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Find primary photo
  const primaryPhoto = photos.find(p => p.is_primary) || photos[0]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 flex flex-col relative">
        <DialogClose
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : error || !subcontractor ? (
          <div className="flex items-center justify-center h-full">
            <Card className="p-8">
              <CardContent className="text-center">
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p className="text-gray-600">{error || 'Failed to load profile'}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-2xl">{subcontractor.name}</DialogTitle>
                <div className="flex items-center gap-2">
                  <Link href={`/subcontractors/${subcontractor.id}`} target="_blank">
                    <Button variant="outline" size="sm">
                      View Full Profile
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* Header Section */}
                <div className="relative -mx-6 -mt-4">
                  <SubcontractorProfileHeader
                    name={subcontractor.name}
                    tradeCategory={subcontractor.trade_category}
                    location={subcontractor.location}
                    rating={subcontractor.google_review_score}
                    licensed={subcontractor.licensed}
                    bonded={subcontractor.bonded}
                    primaryPhotoUrl={primaryPhoto?.image_url}
                    profilePictureUrl={subcontractor.profile_picture_url}
                  />
                </div>

                {/* Photo Gallery */}
                {photos.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Portfolio</h2>
                    <SubcontractorPhotoGallery
                      photos={photos}
                      subcontractorId={subcontractor.id}
                      canUpload={false}
                    />
                  </div>
                )}

                {/* Bio */}
                {(subcontractor.bio || subcontractor.profile_summary) && (
                  <Card>
                    <CardContent className="pt-6">
                      <h2 className="text-xl font-bold mb-4">About</h2>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {subcontractor.bio || subcontractor.profile_summary}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Info and Map Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SubcontractorProfileInfoCard
                    email={subcontractor.email}
                    phone={subcontractor.phone}
                    websiteUrl={subcontractor.website_url}
                    services={subcontractor.services}
                    licensed={subcontractor.licensed}
                    bonded={subcontractor.bonded}
                    timeInBusiness={subcontractor.time_in_business}
                    yearEstablished={subcontractor.year_established}
                    serviceRadius={subcontractor.service_radius}
                    location={subcontractor.location}
                    jobsCompleted={subcontractor.jobs_completed}
                  />

                  <SubcontractorLocationMap
                    location={subcontractor.location}
                    serviceRadius={subcontractor.service_radius}
                  />
                </div>

                {/* Google Reviews Link */}
                {subcontractor.google_reviews_link && (
                  <Card>
                    <CardContent className="pt-6">
                      <a
                        href={subcontractor.google_reviews_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        View Google Reviews →
                      </a>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

