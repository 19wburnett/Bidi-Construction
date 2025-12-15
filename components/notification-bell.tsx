'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, X } from 'lucide-react'

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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = useRef(createClient()).current
  const router = useRouter()

  useEffect(() => {
    // Only fetch if we have a user and haven't fetched yet
    if (user && notifications.length === 0) {
      fetchNotifications()
    }
  }, [user]) // Only depend on user, not empty array

  const fetchNotifications = async () => {
    try {
      if (!user) return

      // Fetching notifications for user

      // First, try to get from notifications table
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select(`
          id,
          read,
          dismissed,
          created_at,
          job_id,
          bid_id,
          bid_package_id,
          notification_type,
          message,
          bids (
            id,
            job_id,
            bid_package_id,
            bid_amount,
            seen,
            created_at,
            subcontractor_email,
            subcontractors (
              id,
              name,
              email
            )
          ),
          jobs (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10)

      // Processing notification data

      if (notificationError && notificationError.code === 'PGRST116') {
        // Notifications table doesn't exist, fall back to bids
        await fetchNotificationsFromBids(user.id)
        return
      }

      if (notificationError) {
        // Fall back to bids if notifications table has issues
        await fetchNotificationsFromBids(user.id)
        return
      }

      // If we have notification data, use it
      if (notificationData && notificationData.length > 0) {
        const notifications = notificationData.map((notif: any) => {
          // Get job info - prefer direct job_id relationship, fallback to bid's job_id
          const jobName = notif.jobs?.name || 'Job'
          const jobId = notif.job_id || notif.bids?.job_id || null

          // Get bid info if available
          const bidId = notif.bid_id || notif.bids?.id || null
          const bidAmount = notif.bids?.bid_amount || null
          const subcontractorName = notif.bids?.subcontractors?.name || 
                                   notif.bids?.subcontractor_email || 
                                   'Unknown Subcontractor'

          return {
            id: bidId || notif.id, // Use bid ID if available, otherwise notification ID
            notification_id: notif.id,
            job_id: jobId,
            job_title: jobName,
            subcontractor_name: subcontractorName,
            bid_amount: bidAmount,
            created_at: notif.bids?.created_at || notif.created_at,
            read: notif.read || false,
            seen: notif.bids?.seen || false,
            dismissed: notif.dismissed || false,
            notification_type: notif.notification_type,
            message: notif.message
          }
        })
        // Processed notifications
        setNotifications(notifications)
      } else {
        // No notifications in table, fall back to bids
        await fetchNotificationsFromBids(user.id)
      }
    } catch (err) {
      // Silent error handling
    } finally {
      setLoading(false)
    }
  }

  const fetchNotificationsFromBids = async (userId: string) => {
    try {
      // Fetching notifications from bids for user
      
      // Fallback: Get recent bids for user's jobs
      const { data: bidsData, error } = await supabase
        .from('bids')
        .select(`
          id,
          job_id,
          bid_amount,
          seen,
          created_at,
          subcontractor_email,
          subcontractors (
            id,
            name,
            email
          ),
          jobs!inner(
            id,
            name,
            user_id
          )
        `)
        .eq('jobs.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      // Processing bids data

      if (error) {
        return
      }

      // Transform the data into notification format
      const notifications = (bidsData || []).map((bid: any) => ({
        id: bid.id,
        job_id: bid.job_id,
        job_title: bid.jobs?.name || 'Job',
          subcontractor_name: bid.subcontractors?.name || bid.subcontractor_email || 'Unknown Subcontractor',
        bid_amount: bid.bid_amount,
        created_at: bid.created_at,
        read: false, // Mark all as unread for fallback
        seen: bid.seen || false,
        dismissed: false // Mark all as not dismissed for fallback
      }))

      // Processed notifications from bids
      setNotifications(notifications)
    } catch (err) {
      // Silent error handling
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      // Find the notification to determine if it has a notification_id
      const notification = notifications.find(n => n.notification_id === notificationId || n.id === notificationId)
      if (!notification) return

      // Marking notification as read

      // If it has a notification_id, update the notifications table
      if (notification.notification_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.notification_id)

        if (notificationError) {
          return
        }
        // Successfully marked notification as read in database
      }

      // Update local state - mark as read
      setNotifications(prev => prev.map(n => {
        const nIdentifier = n.notification_id || n.id
        const identifierToFilter = notification.notification_id || notification.id
        if (nIdentifier === identifierToFilter) {
          return { ...n, read: true }
        }
        return n
      }))
      
      // Successfully marked notification as read in local state
    } catch (err) {
      // Fallback: mark as read in local state
      setNotifications(prev => prev.map(n => {
        const nIdentifier = n.notification_id || n.id
        if (nIdentifier === notificationId) {
          return { ...n, read: true }
        }
        return n
      }))
    }
  }

  const dismissNotification = async (notificationId: string) => {
    try {
      // Find the notification to determine if it has a notification_id
      const notification = notifications.find(n => n.notification_id === notificationId || n.id === notificationId)
      if (!notification) return

      // Dismissing notification

      // If it has a notification_id, update the notifications table
      if (notification.notification_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .update({ dismissed: true })
          .eq('id', notification.notification_id)

        if (notificationError) {
          return
        }
        // Successfully dismissed notification in database
      }

      // Update local state - remove the notification completely
      setNotifications(prev => prev.filter(n => {
        const nIdentifier = n.notification_id || n.id
        const identifierToFilter = notification.notification_id || notification.id
        return nIdentifier !== identifierToFilter
      }))
      
      console.log('Successfully removed notification from local state')
    } catch (err) {
      console.error('Error dismissing notification:', err)
      // Fallback: remove from local state
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

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length

  const handleBellClick = () => {
    // On mobile (screen width < 640px), navigate to notifications page
    if (window.innerWidth < 640) {
      router.push('/notifications')
    } else {
      // On desktop, show dropdown
      setIsOpen(!isOpen)
    }
  }

  const refreshNotifications = () => {
    console.log('Manually refreshing notifications...')
    fetchNotifications()
  }

  if (loading) {
    return (
      <div className="relative">
        <Button variant="ghost" size="sm" disabled>
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBellClick}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10 hidden sm:block" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notifications Dropdown - Hidden on mobile */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-20 max-h-96 overflow-y-auto hidden sm:block">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="py-1">
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
                      // Mark as read when clicked
                      markAsRead(notification.notification_id || notification.id)
                      window.location.href = `/dashboard/jobs/${notification.job_id}`
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
          </div>
        </>
      )}
    </div>
  )
}
