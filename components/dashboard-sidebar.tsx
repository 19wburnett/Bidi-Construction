'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ProfileDropdown from '@/components/profile-dropdown'
import CreditsDisplay from '@/components/credits-display'
import {
  Home,
  Briefcase,
  Calculator,
  Users,
  FileText,
  Mail,
  Bell,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Plus,
  Building2,
  MessageSquare,
  TrendingUp,
  Clock,
  Archive
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface SidebarProps {
  className?: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
  subItems?: {
    label: string
    href: string
    badge?: number | string
  }[]
}

export default function DashboardSidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [stats, setStats] = useState({
    activeJobs: 0,
    activePlans: 0,
    pendingBids: 0,
    unreadNotifications: 0
  })

  const supabase = createClient()

  // Load stats
  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load active jobs count
      const { count: jobsCount } = await supabase
        .from('job_requests')
        .select('*', { count: 'exact', head: true })
        .eq('gc_id', user.id)
        .eq('status', 'active')

      // Load active plans count
      const { count: plansCount } = await supabase
        .from('plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      // Load pending bids count
      const { count: bidsCount } = await supabase
        .from('bids')
        .select('*, job_requests!inner(gc_id)', { count: 'exact', head: true })
        .eq('job_requests.gc_id', user.id)
        .is('seen_at', null)

      setStats({
        activeJobs: jobsCount || 0,
        activePlans: plansCount || 0,
        pendingBids: bidsCount || 0,
        unreadNotifications: 0 // You can implement this based on your notification system
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: Home
    },
    {
      label: 'Plans',
      href: '/dashboard/plans',
      icon: FileText,
      badge: stats.activePlans > 0 ? stats.activePlans : undefined,
      subItems: [
        { label: 'Upload Plan', href: '/dashboard/plans/new' },
        { label: 'All Plans', href: '/dashboard/plans' }
      ]
    },
    {
      label: 'Jobs',
      href: '/dashboard/jobs',
      icon: Briefcase,
      badge: stats.activeJobs > 0 ? stats.activeJobs : undefined,
      subItems: [
        { label: 'New Job', href: '/dashboard/new-job' }
      ]
    },
    {
      label: 'Contacts',
      href: '/dashboard/contacts',
      icon: Users
    },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badge: stats.unreadNotifications > 0 ? stats.unreadNotifications : undefined
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: Settings
    }
  ]

  function isActiveLink(href: string): boolean {
    // Remove hash from href for comparison
    const cleanHref = href.split('#')[0]
    
    if (cleanHref === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/'
    }
    return pathname.startsWith(cleanHref)
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <img 
                src="/brand/Bidi Contracting Logo.svg" 
                alt="Bidi" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold font-bidi">BIDI</span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" className="mx-auto">
              <img 
                src="/brand/Bidi Contracting Logo.svg" 
                alt="Bidi" 
                className="h-8 w-8"
              />
            </Link>
          )}
        </div>
        
        {/* User Actions (Credits, Profile with Notifications) */}
        {!isCollapsed && (
          <div className="px-4 pb-4 space-y-3">
            <CreditsDisplay />
            <ProfileDropdown />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="space-y-2">
            <Link href="/dashboard/plans/new" className="block">
              <Button className="w-full justify-start" size="sm" variant="default">
                <Plus className="h-4 w-4 mr-2" />
                Upload Plan
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = isActiveLink(item.href)
            const hasSubItems = item.subItems && item.subItems.length > 0

            return (
              <div key={`${item.href}-${index}`}>
                <Link href={item.href}>
                  <div
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer group',
                      isActive
                        ? 'bg-orange-50 text-orange-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <Icon
                        className={cn(
                          'h-5 w-5 flex-shrink-0',
                          isActive ? 'text-orange-600' : 'text-gray-500 group-hover:text-gray-700'
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>
                    {!isCollapsed && item.badge && (
                      <Badge 
                        variant={isActive ? "default" : "secondary"}
                        className="ml-auto flex-shrink-0"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>

                {/* Sub-items */}
                {!isCollapsed && hasSubItems && isActive && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems?.map((subItem) => (
                      <Link key={subItem.href} href={subItem.href}>
                        <div
                          className={cn(
                            'px-3 py-1.5 rounded text-sm transition-colors cursor-pointer',
                            pathname === subItem.href
                              ? 'text-orange-600 font-medium'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          )}
                        >
                          {subItem.label}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Stats Summary (when not collapsed) */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Jobs</span>
              <span className="font-semibold">{stats.activeJobs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Plans</span>
              <span className="font-semibold">{stats.activePlans}</span>
            </div>
            {stats.pendingBids > 0 && (
              <div className="flex items-center justify-between text-orange-600">
                <span>Pending Bids</span>
                <span className="font-semibold">{stats.pendingBids}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

