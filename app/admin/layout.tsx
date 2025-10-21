'use client'

import { usePathname } from 'next/navigation'
import DashboardLayout from '@/components/dashboard-layout'

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  // Don't wrap fullscreen pages (like the plan analyzer detail view)
  const isFullscreenPage = pathname?.includes('/analyze-plans/') && 
                          pathname?.split('/').length > 3
  
  if (isFullscreenPage) {
    return <>{children}</>
  }
  
  return <DashboardLayout>{children}</DashboardLayout>
}

