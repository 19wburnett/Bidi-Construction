'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import ProfileDropdown from '@/components/profile-dropdown'
import CreditsDisplay from '@/components/credits-display'
import {
  Home,
  Building2,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  TrendingUp,
  Clock,
  Archive,
  FileText,
  Package,
  Bell,
  Bot,
  FilePlus,
  UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import logo from '../public/brand/Bidi Contracting Logo.svg'

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
  const [userRole, setUserRole] = useState<string | null>(null)

  const supabase = createClient()

  // Load sidebar state from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem('dashboard-sidebar-collapsed')
    if (saved === 'true') {
      setIsCollapsed(true)
    }
  }, [])

  // Check admin status and user role on mount and listen to auth changes
  useEffect(() => {
    checkAdminStatus()
    checkUserRole()

    // Listen for auth state changes to re-check admin status and role
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus()
      checkUserRole()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  async function checkUserRole() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setUserRole(null)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user role:', error)
        setUserRole(null)
        return
      }

      setUserRole(data?.role || null)
    } catch (error) {
      console.error('Error checking user role:', error)
      setUserRole(null)
    }
  }

  async function checkAdminStatus() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Error getting user:', userError)
        setIsAdmin(false)
        return
      }
      
      if (!user) {
        setIsAdmin(false)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching admin status:', error)
        setIsAdmin(false)
        return
      }

      setIsAdmin(data?.is_admin || false)
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: Home
    },
    {
      label: 'Contacts',
      href: '/dashboard/contacts',
      icon: Users
    },
    // Add Quotes menu item for subcontractors
    ...(userRole === 'sub' ? [{
      label: 'Quotes',
      href: '/dashboard/quotes',
      icon: FileText
    }] : []),
    {
      label: 'Blueprint Chat',
      href: '/dashboard/chat',
      icon: Bot
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
        { label: 'Analyze Plans', href: '/admin/analyze-plans' },
        { label: 'Quote Requests', href: '/admin/quotes' },
        { label: 'Test Multi Takeoff', href: '/admin/test-multi-takeoff' },
        { label: 'Crawler', href: '/admin/crawler' },
        { label: 'Subcontractors', href: '/admin/manage-subcontractors' },
        { label: 'Enrich Subcontractors', href: '/admin/subcontractors/enrich' },
        { label: 'Team Invitations', href: '/admin/invitations' },
        { label: 'Manage Bids', href: '/admin/manage-bids' },
        { label: 'Workflow Demo', href: '/admin/workflow-demo' }
      ]
    }
  ] : []

  function isActiveLink(href: string): boolean {
    const cleanHref = href.split('#')[0]
    
    if (cleanHref === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/'
    }
    return pathname.startsWith(cleanHref)
  }

  // Nav item component with tooltip support for collapsed state
  const NavItemComponent = ({ item, index }: { item: NavItem; index: number }) => {
    const Icon = item.icon
    const isActive = isActiveLink(item.href)
    const hasSubItems = item.subItems && item.subItems.length > 0

    const navContent = (
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ease-out cursor-pointer group',
          isActive
            ? 'bg-gradient-to-r from-orange-500/10 to-orange-400/5 text-orange-600 dark:text-orange-400 font-medium shadow-sm shadow-orange-500/10'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200',
          !isCollapsed && 'hover:translate-x-0.5'
        )}
      >
        <div className={cn(
          'flex items-center min-w-0',
          !isCollapsed && 'space-x-3'
        )}>
          <Icon
            className={cn(
              'h-5 w-5 flex-shrink-0 transition-colors duration-200',
              isActive 
                ? 'text-orange-500 dark:text-orange-400' 
                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
            )}
          />
          {!isCollapsed && (
            <span className="truncate text-sm">{item.label}</span>
          )}
        </div>
        {!isCollapsed && item.badge && (
          <Badge 
            variant={isActive ? "default" : "secondary"}
            className={cn(
              "ml-auto flex-shrink-0 text-xs",
              isActive && "bg-orange-500 hover:bg-orange-600"
            )}
          >
            {item.badge}
          </Badge>
        )}
      </div>
    )

    return (
      <div key={`${item.href}-${index}`}>
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link href={item.href}>
                {navContent}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.label}
              {item.badge && ` (${item.badge})`}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link href={item.href}>
            {navContent}
          </Link>
        )}

        {/* Sub-items */}
        {!isCollapsed && hasSubItems && isActive && (
          <div className="ml-8 mt-1.5 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
            {item.subItems?.map((subItem) => (
              <Link key={subItem.href} href={subItem.href}>
                <div
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer',
                    pathname === subItem.href
                      ? 'text-orange-600 dark:text-orange-400 font-medium bg-orange-50/50 dark:bg-orange-950/30'
                      : 'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30'
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
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex flex-col h-full bg-white dark:bg-gray-950 border-r border-gray-200/80 dark:border-gray-800/50 transition-all duration-300 ease-out',
          isCollapsed ? 'w-[72px]' : 'w-64',
          className
        )}
      >
        {/* Header - Logo and User Section */}
        <div className="p-4 space-y-4">
          {/* Logo */}
          <div className={cn(
            'flex items-center',
            isCollapsed ? 'justify-center' : 'space-x-2.5'
          )}>
            <Link href="/dashboard" className={cn(
              'flex items-center transition-transform duration-200 hover:scale-105',
              !isCollapsed && 'space-x-2.5'
            )}>
              <img 
                src={logo.src} 
                alt="Bidi" 
                className="h-9 w-9"
              />
              {!isCollapsed && (
                <span className="text-xl font-bold tracking-tight dark:text-white font-bidi">BIDI</span>
              )}
            </Link>
          </div>
          
          {/* User Actions (Credits, Profile) */}
          {!isCollapsed && (
            <div className="space-y-2.5 pt-2">
              <CreditsDisplay />
              <ProfileDropdown />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

        {/* Quick Actions - Create New Popover */}
        {!isCollapsed && (
          <div className="p-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  className="w-full justify-center bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 hover:scale-[1.02]" 
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start" side="right">
                <div className="flex flex-col space-y-1">
                  <Link href="/dashboard/jobs/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <Plus className="h-4 w-4 mr-2 text-orange-500" />
                      Create Job
                    </Button>
                  </Link>
                  <Link href="/dashboard/plans/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <FilePlus className="h-4 w-4 mr-2 text-blue-500" />
                      Upload Plan
                    </Button>
                  </Link>
                  <Link href="/dashboard/contacts">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <UserPlus className="h-4 w-4 mr-2 text-green-500" />
                      Add Contact
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Collapsed Create New Button */}
        {isCollapsed && (
          <div className="px-3 pb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/25" 
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start" side="right">
                <div className="flex flex-col space-y-1">
                  <Link href="/dashboard/jobs/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <Plus className="h-4 w-4 mr-2 text-orange-500" />
                      Create Job
                    </Button>
                  </Link>
                  <Link href="/dashboard/plans/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <FilePlus className="h-4 w-4 mr-2 text-blue-500" />
                      Upload Plan
                    </Button>
                  </Link>
                  <Link href="/dashboard/contacts">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <UserPlus className="h-4 w-4 mr-2 text-green-500" />
                      Add Contact
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1">
            {[...navItems, ...adminNavItems].map((item, index) => (
              <NavItemComponent key={`${item.href}-${index}`} item={item} index={index} />
            ))}
          </div>
        </nav>

        {/* Collapse Button */}
        <div className="p-3">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent mb-3" />
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newCollapsed = !isCollapsed
                    setIsCollapsed(newCollapsed)
                    localStorage.setItem('dashboard-sidebar-collapsed', String(newCollapsed))
                  }}
                  className="w-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                Expand Sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newCollapsed = !isCollapsed
                setIsCollapsed(newCollapsed)
                localStorage.setItem('dashboard-sidebar-collapsed', String(newCollapsed))
              }}
              className="w-full justify-start text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span className="text-sm">Collapse</span>
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
