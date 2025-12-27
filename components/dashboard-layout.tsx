'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import DashboardSidebar from './dashboard-sidebar'
import { Button } from './ui/button'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Check if we are in the plan viewer (immersive mode)
  // Path pattern: /dashboard/jobs/[jobId]/plans/[planId]
  const isPlanViewer = /^\/dashboard\/jobs\/[^/]+\/plans\/[^/]+$/.test(pathname || '')
  
  // State for desktop sidebar visibility in immersive mode
  // In immersive mode, default to closed. In normal mode, always open.
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(!isPlanViewer)

  // Update desktop sidebar state when entering/leaving immersive mode
  useEffect(() => {
    if (isPlanViewer) {
      setDesktopSidebarOpen(false)
    } else {
      setDesktopSidebarOpen(true)
    }
  }, [isPlanViewer])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="flex h-screen">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Desktop */}
        <aside 
          className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            isPlanViewer 
              ? (desktopSidebarOpen ? '' : 'w-0') 
              : ''
          }`}
        >
          <DashboardSidebar />
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <aside
            className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 translate-x-0`}
          >
            <DashboardSidebar />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {/* Mobile Menu Button */}
          <div className={`lg:hidden sticky top-0 z-30 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 py-3 transition-colors duration-300 flex items-center`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold">Menu</span>
          </div>

          {/* Desktop Immersive Toggle Button - Only visible in Plan Viewer */}
          {isPlanViewer && (
            <div className="hidden lg:block absolute bottom-6 left-6 z-40">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full shadow-md bg-white/90 hover:bg-white dark:bg-black/90 dark:hover:bg-black border border-gray-200 dark:border-gray-800 h-10 w-10"
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                title={desktopSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {desktopSidebarOpen ? (
                  <PanelLeftClose className="h-5 w-5" />
                ) : (
                  <PanelLeftOpen className="h-5 w-5" />
                )}
              </Button>
            </div>
          )}

          {/* Page Content */}
          <div className={`flex-1 overflow-auto ${className || ''}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
