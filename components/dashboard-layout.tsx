'use client'

import { useState } from 'react'
import DashboardSidebar from './dashboard-sidebar'
import { Button } from './ui/button'
import { Menu } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        <aside className="hidden lg:block flex-shrink-0">
          <DashboardSidebar />
        </aside>

        {/* Sidebar - Mobile */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <DashboardSidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile Menu Button */}
          <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-4 py-3 transition-colors duration-300">
            <Button
              variant="default"
              size="default"
              onClick={() => setSidebarOpen(true)}
              className="shadow-sm"
            >
              <Menu className="h-5 w-5 mr-2" />
              Menu
            </Button>
          </div>

          {/* Page Content */}
          <div className={className}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

