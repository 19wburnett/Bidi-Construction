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
  Building2,
  Users,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  TrendingUp,
  Clock,
  Archive,
  FileText,
  Package,
  Bell
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState({
    activeJobs: 0,
    unreadNotifications: 0,
    pendingAnalyses: 0,
    activePlans: 0,
    pendingBids: 0
  })

  const supabase = createClient()

  // Load sidebar state from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem('dashboard-sidebar-collapsed')
    if (saved === 'true') {
      setIsCollapsed(true)
    }
  }, [])

  // Load stats
  useEffect(() => {
    checkAdminStatus()
  }, [])

  useEffect(() => {
    loadStats()
  }, [isAdmin])

  async function checkAdminStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      setIsAdmin(data?.is_admin || false)
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }

  async function loadStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load active jobs count
      const { count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')

      // Load unread notifications count
      // Note: This assumes notifications table exists with 'read' column
      // If table doesn't exist, this will fail gracefully
      let notificationsCount = 0
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)
        notificationsCount = count || 0
      } catch (notifError) {
        // Notifications table may not exist, silently fail
        console.warn('Could not load notifications count:', notifError)
      }

      setStats({
        activeJobs: jobsCount || 0,
        unreadNotifications: notificationsCount || 0,
        pendingAnalyses: 0,
        activePlans: 0,
        pendingBids: 0
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
      label: 'Jobs',
      href: '/dashboard/jobs',
      icon: Building2,
      badge: stats.activeJobs > 0 ? stats.activeJobs : undefined,
      subItems: [
        { label: 'All Jobs', href: '/dashboard/jobs' },
        { label: 'New Job', href: '/dashboard/jobs/new' }
      ]
    },
    {
      label: 'Contacts',
      href: '/dashboard/contacts',
      icon: Users
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: Settings
    }
  ]

  // Admin-only nav items
  const adminNavItems: NavItem[] = isAdmin ? [
    {
      label: 'Admin',
      href: '/admin/demo-settings',
      icon: Building2,
      subItems: [
        { 
          label: 'Analyze Plans', 
          href: '/admin/analyze-plans',
          badge: stats.pendingAnalyses > 0 ? stats.pendingAnalyses : undefined
        },
        { label: 'Crawler', href: '/admin/crawler' },
        { label: 'Subcontractors', href: '/admin/manage-subcontractors' },
        { label: 'Manage Bids', href: '/admin/manage-bids' },
        { label: 'Workflow Demo', href: '/admin/workflow-demo' }
      ]
    }
  ] : []

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
        'flex flex-col h-full bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between p-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <img 
                src="/brand/Bidi Contracting Logo.svg" 
                alt="Bidi" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold font-bidi dark:text-white">BIDI</span>
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
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
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
          {[...navItems, ...adminNavItems].map((item, index) => {
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
                        ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
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
                              ? 'text-orange-600 dark:text-orange-400 font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900'
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Jobs</span>
              <span className="font-semibold dark:text-white">{stats.activeJobs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Plans</span>
              <span className="font-semibold dark:text-white">{stats.activePlans}</span>
            </div>
            {stats.pendingBids > 0 && (
              <div className="flex items-center justify-between text-orange-600 dark:text-orange-400">
                <span>Pending Bids</span>
                <span className="font-semibold">{stats.pendingBids}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapse Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const newCollapsed = !isCollapsed
            setIsCollapsed(newCollapsed)
            localStorage.setItem('dashboard-sidebar-collapsed', String(newCollapsed))
          }}
          className="w-full dark:text-gray-300 dark:hover:text-white"
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

