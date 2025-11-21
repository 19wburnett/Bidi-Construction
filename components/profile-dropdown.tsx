'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, LogOut, LayoutDashboard, Bell, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface UserProfile {
  id: string
  email: string
  avatar_url?: string
  full_name?: string
}

interface Notification {
  id: string
  job_id: string
  job_title: string
  subcontractor_name: string
  bid_amount: number | null
  created_at: string
  read: boolean
  seen: boolean
  dismissed: boolean
  notification_id?: string
}

export default function ProfileDropdown() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // Simple check - just get the current user
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          avatar_url: authUser.user_metadata?.picture || authUser.user_metadata?.avatar_url,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name
        })

        // Determine admin status
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', authUser.id)
          .single()
        
        if (error) {
          console.error('Error checking admin status in profile dropdown:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(!!userData?.is_admin)
        }

        // Fetch notifications
        fetchNotifications(authUser.id)
      } else {
        setIsAdmin(false)
      }
    }
    
    getUser()

    // Listen for auth state changes to re-check admin status
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const fetchNotifications = async (userId: string) => {
    try {
      // First, try to get from notifications table
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select(`
          id,
          read,
          dismissed,
          created_at,
          bids!inner(
            id,
            job_request_id,
            bid_amount,
            seen,
            created_at,
            subcontractor_email,
            subcontractors (
              id,
              name,
              email
            ),
            job_requests!inner(
              trade_category
            )
          )
        `)
        .eq('user_id', userId)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (notificationError && notificationError.code === 'PGRST116') {
        // Notifications table doesn't exist, fall back to bids
        await fetchNotificationsFromBids(userId)
        return
      }

      if (notificationError) {
        await fetchNotificationsFromBids(userId)
        return
      }

      // If we have notification data, use it
      if (notificationData && notificationData.length > 0) {
        const notifications = notificationData.map((notif: any) => ({
          id: notif.bids.id,
          notification_id: notif.id,
          job_id: notif.bids.job_request_id,
          job_title: notif.bids.job_requests.trade_category,
          subcontractor_name: notif.bids.subcontractors?.name || notif.bids.subcontractor_email || 'Unknown Subcontractor',
          bid_amount: notif.bids.bid_amount,
          created_at: notif.bids.created_at,
          read: notif.read,
          seen: notif.bids.seen,
          dismissed: notif.dismissed || false
        }))
        setNotifications(notifications)
      } else {
        await fetchNotificationsFromBids(userId)
      }
    } catch (err) {
      // Silent error handling
    }
  }

  const fetchNotificationsFromBids = async (userId: string) => {
    try {
      const { data: bidsData, error } = await supabase
        .from('bids')
        .select(`
          id,
          job_request_id,
          bid_amount,
          seen,
          created_at,
          subcontractor_email,
          subcontractors (
            id,
            name,
            email
          ),
          job_requests!inner(
            id,
            trade_category,
            gc_id
          )
        `)
        .eq('job_requests.gc_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        return
      }

      const notifications = (bidsData || []).map((bid: any) => ({
        id: bid.id,
        job_id: bid.job_request_id,
        job_title: bid.job_requests.trade_category,
        subcontractor_name: bid.subcontractors?.name || bid.subcontractor_email || 'Unknown Subcontractor',
        bid_amount: bid.bid_amount,
        created_at: bid.created_at,
        read: bid.seen || false,
        seen: bid.seen || false,
        dismissed: false
      }))

      setNotifications(notifications)
    } catch (err) {
      console.error('Error fetching notifications from bids:', err)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.notification_id === notificationId || n.id === notificationId)
      if (!notification) return

      if (notification.notification_id) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.notification_id)
      } else {
        // Fallback: mark bid as seen
        await supabase
          .from('bids')
          .update({ seen: true })
          .eq('id', notificationId)
      }

      setNotifications(prev => prev.map(n => {
        const nIdentifier = n.notification_id || n.id
        const identifierToFilter = notification.notification_id || notification.id
        if (nIdentifier === identifierToFilter) {
          return { ...n, read: true, seen: true }
        }
        return n
      }))
    } catch (err) {
      console.error('Error marking notification as read:', err)
      // Fallback: mark as read in local state
      setNotifications(prev => prev.map(n => {
        const nIdentifier = n.notification_id || n.id
        if (nIdentifier === notificationId) {
          return { ...n, read: true, seen: true }
        }
        return n
      }))
    }
  }

  const dismissNotification = async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.notification_id === notificationId || n.id === notificationId)
      if (!notification) return

      if (notification.notification_id) {
        await supabase
          .from('notifications')
          .update({ dismissed: true })
          .eq('id', notification.notification_id)
      }

      setNotifications(prev => prev.filter(n => {
        const nIdentifier = n.notification_id || n.id
        const identifierToFilter = notification.notification_id || notification.id
        return nIdentifier !== identifierToFilter
      }))
    } catch (err) {
      setNotifications(prev => prev.filter(n => {
        const nIdentifier = n.notification_id || n.id
        return nIdentifier !== notificationId
      }))
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length

  if (!user) return null

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center space-x-2 p-2 relative"
        >
          {user.avatar_url ? (
            <img
              src={`https://images.weserv.nl/?url=${encodeURIComponent(user.avatar_url)}&w=32&h=32&fit=cover&mask=circle`}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                // Fallback to initials if image fails to load
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={`w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ${user.avatar_url ? 'hidden' : ''}`}>
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:block text-sm font-medium">
            {user.full_name || user.email}
          </span>
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 max-h-[500px] flex flex-col" align="start">
        <div className="py-1 border-b">
          <div className="px-4 py-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.full_name || 'User'}
            </p>
            <p className="text-sm text-gray-500 truncate" title={user.email}>
              {user.email}
            </p>
          </div>
        </div>

        {/* Toggle between Notifications and Menu */}
        <div className="flex border-b">
          <button
            onClick={() => setShowNotifications(true)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              showNotifications
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] flex items-center justify-center p-1 text-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </div>
          </button>
          <button
            onClick={() => setShowNotifications(false)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              !showNotifications
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <User className="w-4 h-4" />
              <span>Account</span>
            </div>
          </button>
        </div>

        {/* Content */}
        {showNotifications ? (
          <div className="overflow-y-auto flex-1 max-h-[300px]">
            {notifications.filter(n => !n.dismissed).length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No new notifications</p>
              </div>
            ) : (
              notifications.filter(n => !n.dismissed).map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer ${
                    !notification.read ? 'bg-blue-50' : !notification.seen ? 'bg-yellow-50' : ''
                  }`}
                  onClick={() => {
                    markAsRead(notification.notification_id || notification.id)
                    router.push(`/dashboard/jobs/${notification.job_id}`)
                    setIsOpen(false)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          New bid on {notification.job_title}
                        </p>
                        {!notification.read ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Unread notification"></div>
                        ) : !notification.seen ? (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" title="Unseen bid"></div>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {notification.subcontractor_name}
                      </p>
                      {notification.bid_amount && (
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(notification.bid_amount)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          dismissNotification(notification.notification_id || notification.id)
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="py-1">
            {isAdmin && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/admin/demo-settings')
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Admin Dashboard
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
