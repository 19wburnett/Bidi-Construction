'use client'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Star, MapPin, Shield, Award, Mail, MessageSquare, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useImageBrightness } from '@/lib/hooks/use-image-brightness'

interface SubcontractorProfileHeaderProps {
  name: string
  tradeCategory: string
  location: string
  rating?: number | null
  licensed?: boolean | null
  bonded?: boolean | null
  primaryPhotoUrl?: string | null
  profilePictureUrl?: string | null
}

// Helper to check if URL is from Supabase (safe for Next.js Image)
function isSupabaseUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('supabase.co') || urlObj.hostname.includes('supabase.in')
  } catch {
    return false
  }
}

export default function SubcontractorProfileHeader({
  name,
  tradeCategory,
  location,
  rating,
  licensed,
  bonded,
  primaryPhotoUrl,
  profilePictureUrl,
}: SubcontractorProfileHeaderProps) {
  const backgroundImage = primaryPhotoUrl
  const avatarImage = profilePictureUrl
  const isBackgroundDark = useImageBrightness(backgroundImage)
  const isAvatarSupabase = isSupabaseUrl(avatarImage)

  return (
    <div className="relative w-full bg-white">
      {/* Background image / Cover */}
      <div className="relative h-48 md:h-80 w-full overflow-hidden">
        {backgroundImage ? (
          <>
            <Image
              src={backgroundImage}
              alt={`${name} cover`}
              fill
              className="object-cover"
              priority
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${isBackgroundDark ? 'from-black/60 via-black/20' : 'from-white/50 via-white/20'} to-transparent`} />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600" />
        )}
      </div>

      {/* Profile Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20 md:-mt-28 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          {/* Avatar and Basic Info */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6 flex-1 min-w-0">
            <div className="relative h-32 w-32 md:h-48 md:w-48 rounded-3xl overflow-hidden border-4 border-white bg-white shadow-2xl flex-shrink-0">
              {avatarImage ? (
                isAvatarSupabase ? (
                  <Image
                    src={avatarImage}
                    alt={name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarImage}
                    alt={name}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const fallback = target.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                )
              ) : null}
              {!avatarImage && (
                <div className="h-full w-full flex items-center justify-center bg-gray-100 text-orange-500 text-5xl font-bold">
                  {name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 mb-2">
              <div className="relative group max-w-fit">
                <div className={`absolute -inset-x-4 -inset-y-2 backdrop-blur-md rounded-2xl shadow-xl border z-0 ${
                  isBackgroundDark 
                    ? 'bg-black/40 border-white/10 shadow-black/20' 
                    : 'bg-white/60 border-black/5 shadow-gray-200'
                }`} />
                <h1 className={`relative z-10 text-3xl md:text-5xl font-black truncate leading-tight tracking-tight px-1 drop-shadow-sm ${
                  isBackgroundDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {name}
                </h1>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mt-4 text-gray-700 font-medium">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-3 py-1 font-bold">
                    {tradeCategory}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1.5 bg-white/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">{location}</span>
                </div>

                {rating && rating > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-gray-900">{rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Credentials */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {licensed && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                    <Shield className="h-3 w-3" />
                    Licensed
                  </Badge>
                )}
                {bonded && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                    <Award className="h-3 w-3" />
                    Bonded
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 self-start md:self-end md:mb-2">
            <Button variant="outline" className="flex-1 md:flex-none gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button className="flex-1 md:flex-none gap-2 bg-orange-600 hover:bg-orange-700 text-white border-none shadow-md">
              <MessageSquare className="h-4 w-4" />
              Contact
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

