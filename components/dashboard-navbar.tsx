'use client'

import { Button } from '@/components/ui/button'
import { Building2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import CreditsDisplay from '@/components/credits-display'
import NotificationBell from '@/components/notification-bell'
import logo from '../public/brand/Bidi Contracting Logo.svg'    

interface DashboardNavbarProps {
  title?: string
  showBackButton?: boolean
  backButtonHref?: string
  backButtonText?: string
  showCredits?: boolean
  showNotifications?: boolean
  showProfile?: boolean
}

export default function DashboardNavbar({
  title = "BIDI Dashboard",
  showBackButton = false,
  backButtonHref = "/dashboard",
  backButtonText = "Back to Dashboard",
  showCredits = true,
  showNotifications = true,
  showProfile = true,
}: DashboardNavbarProps) {
  // Check if title contains "BIDI" to apply custom font
  const renderTitle = () => {
    if (title.includes('BIDI')) {
      return title.split('BIDI').map((part, index) => (
        index === 0 ? (
          <span key={index}>
            <span className="font-bidi">BIDI</span>{part}
          </span>
        ) : part
      ));
    }
    return title;
  };

  return (
    <header className="bg-white border-b-2 border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <img src={logo.src} alt="BIDI" className="h-6 w-6 sm:h-8 sm:w-8 text-black" />    
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{renderTitle()}</h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          {showBackButton && (
            <Link href={backButtonHref}>
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backButtonText}
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {showCredits && <CreditsDisplay />}
          {showNotifications && <NotificationBell />}
          {showProfile && <ProfileDropdown />}
        </div>
      </div>
    </header>
  )
}
