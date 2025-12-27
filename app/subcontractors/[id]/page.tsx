'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import PublicLayout from '@/components/public-layout'
import SubcontractorProfileHeader from '@/components/subcontractor-profile-header'
import SubcontractorPhotoGallery from '@/components/subcontractor-photo-gallery'
import SubcontractorProfileInfoCard from '@/components/subcontractor-profile-info-card'
import SubcontractorLocationMap from '@/components/subcontractor-location-map'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import { useAuth } from '@/app/providers'
import { createClient } from '@/lib/supabase'

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
  notes?: string | null
  profile_picture_url?: string | null
  profile_summary?: string | null
  services?: string[] | null
  bio?: string | null
  service_radius?: number | null
  year_established?: number | null
}

export default function SubcontractorProfilePage() {
  const params = useParams()
  const { user } = useAuth()
  const subcontractorId = params.id as string
  const supabase = createClient()

  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null)
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!subcontractorId) return

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
  }, [subcontractorId])

  const handleUploadSuccess = async () => {
    // Refetch photos after upload
    try {
      const response = await fetch(`/api/subcontractors/${subcontractorId}/photos`)
      if (response.ok) {
        const data = await response.json()
        setPhotos(data.photos || [])
      }
    } catch (err) {
      console.error('Error refetching photos:', err)
    }
  }

  // Check if user is admin (for upload permissions)
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false)
        return
      }

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(userData?.is_admin || false)
        }
      } catch (err) {
        console.error('Error checking admin status:', err)
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [user, supabase])

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <FallingBlocksLoader text="Loading profile..." size="md" />
        </div>
      </PublicLayout>
    )
  }

  if (error || !subcontractor) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Card className="p-8">
            <CardContent className="text-center">
              <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
              <p className="text-gray-600">{error || 'The subcontractor profile you are looking for does not exist.'}</p>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    )
  }

  // Find primary photo
  const primaryPhoto = photos.find(p => p.is_primary) || photos[0]

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
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

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-10">
              {/* Bio / About */}
              {(subcontractor.bio || subcontractor.profile_summary) && (
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">About {subcontractor.name}</h2>
                  </div>
                  <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardContent className="pt-8 pb-8 px-8">
                      <p className="text-gray-600 leading-relaxed whitespace-pre-line text-lg">
                        {subcontractor.bio || subcontractor.profile_summary}
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Photo Gallery */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Project Portfolio</h2>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">{photos.length} Photos</span>
                </div>
                <SubcontractorPhotoGallery
                  photos={photos}
                  subcontractorId={subcontractor.id}
                  canUpload={isAdmin}
                  onUploadSuccess={handleUploadSuccess}
                />
              </section>
            </div>

            {/* Right Column - Sidebar (Sticky) */}
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* Info Card */}
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

              {/* Location Map */}
              <SubcontractorLocationMap
                location={subcontractor.location}
                serviceRadius={subcontractor.service_radius}
              />

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
        </div>
      </div>
    </PublicLayout>
  )
}

