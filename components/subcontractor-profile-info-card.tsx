'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Phone, Globe, Clock, MapPin, Briefcase, ExternalLink, Calendar, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface SubcontractorProfileInfoCardProps {
  email?: string | null
  phone?: string | null
  websiteUrl?: string | null
  services?: string[] | null
  licensed?: boolean | null
  bonded?: boolean | null
  timeInBusiness?: string | null
  yearEstablished?: number | null
  serviceRadius?: number | null
  location?: string | null
  jobsCompleted?: number | null
}

export default function SubcontractorProfileInfoCard({
  email,
  phone,
  websiteUrl,
  services,
  licensed,
  bonded,
  timeInBusiness,
  yearEstablished,
  serviceRadius,
  location,
  jobsCompleted,
}: SubcontractorProfileInfoCardProps) {
  return (
    <Card className="shadow-sm border-gray-200 overflow-hidden">
      <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          Business Details
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 border-b border-gray-100">
          {yearEstablished && (
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Established</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-orange-500" />
                {yearEstablished}
              </span>
            </div>
          )}
          {jobsCompleted !== null && jobsCompleted !== undefined && (
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Jobs Completed</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {jobsCompleted}
              </span>
            </div>
          )}
          {serviceRadius && (
            <div className="p-4 flex flex-col gap-1 col-span-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Service Area</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                {serviceRadius} mile radius around {location?.split(',')[0] || location}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-6">
          {/* Contact Information */}
          {(email || phone || websiteUrl) && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Contact Information
              </h3>
              <div className="space-y-2">
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Email</span>
                      <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate font-medium">{email}</span>
                    </div>
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100">
                    <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Phone</span>
                      <span className="text-sm text-gray-700 group-hover:text-green-600 font-medium">{phone}</span>
                    </div>
                  </a>
                )}
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100"
                  >
                    <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Website</span>
                      <span className="text-sm text-gray-700 group-hover:text-orange-600 font-medium flex items-center gap-1">
                        Visit Site
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Services */}
          {services && services.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Our Expertise
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {services.map((service, index) => (
                  <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none font-medium px-2.5 py-1 text-[11px]">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

