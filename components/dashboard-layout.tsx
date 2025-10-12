'use client'

import { useState } from 'react'
import DashboardSidebar from './dashboard-sidebar'
import { Button } from './ui/button'
import { Menu, X } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

export default function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
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
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 -right-12 bg-white shadow-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile Menu Button */}
          <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
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

