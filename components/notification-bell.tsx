'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
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
  notification_id?: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchNotifications()
    
    // Set up real-time subscription for new bids and updates
    const channel = supabase
      .channel('bids_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids'
        },
        (payload) => {
          // When a new bid is inserted, fetch updated notifications
          fetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bids'
        },
        (payload) => {
          // When a bid is updated (e.g., seen status), fetch updated notifications
          console.log('Bid updated:', payload)
          fetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          // When a notification is updated, fetch updated notifications
          console.log('Notification updated:', payload)
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      console.log('Fetching notifications for user:', user.id)

      // First, try to get from notifications table
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select(`
          id,
          read,
          created_at,
          bids!inner(
            id,
            job_request_id,
            subcontractor_name,
            bid_amount,
            seen,
            created_at,
            job_requests!inner(
              trade_category
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      console.log('Notification data:', notificationData)
      console.log('Notification error:', notificationError)

      if (notificationError && notificationError.code === 'PGRST116') {
        // Notifications table doesn't exist, fall back to bids
        console.log('Notifications table does not exist, falling back to bids')
        await fetchNotificationsFromBids(user.id)
        return
      }

      if (notificationError) {
        console.error('Error fetching notifications:', notificationError)
        // Fall back to bids if notifications table has issues
        await fetchNotificationsFromBids(user.id)
        return
      }

      // If we have notification data, use it
      if (notificationData && notificationData.length > 0) {
        const notifications = notificationData.map((notif: any) => ({
          id: notif.bids.id,
          notification_id: notif.id,
          job_id: notif.bids.job_request_id,
          job_title: notif.bids.job_requests.trade_category,
          subcontractor_name: notif.bids.subcontractor_name || 'Unknown Subcontractor',
          bid_amount: notif.bids.bid_amount,
          created_at: notif.bids.created_at,
          read: notif.read,
          seen: notif.bids.seen
        }))
        console.log('Processed notifications:', notifications)
        setNotifications(notifications)
      } else {
        // No notifications in table, fall back to bids
        console.log('No notifications found, falling back to bids')
        await fetchNotificationsFromBids(user.id)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotificationsFromBids = async (userId: string) => {
    try {
      console.log('Fetching notifications from bids for user:', userId)
      
      // Fallback: Get recent bids for user's jobs
      const { data: bidsData, error } = await supabase
        .from('bids')
        .select(`
          id,
          job_request_id,
          subcontractor_name,
          bid_amount,
          seen,
          created_at,
          job_requests!inner(
            id,
            trade_category,
            gc_id
          )
        `)
        .eq('job_requests.gc_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      console.log('Bids data:', bidsData)
      console.log('Bids error:', error)

      if (error) {
        console.error('Error fetching notifications from bids:', error)
        return
      }

      // Transform the data into notification format
      const notifications = (bidsData || []).map((bid: any) => ({
        id: bid.id,
        job_id: bid.job_request_id,
        job_title: bid.job_requests.trade_category,
        subcontractor_name: bid.subcontractor_name || 'Unknown Subcontractor',
        bid_amount: bid.bid_amount,
        created_at: bid.created_at,
        read: false, // Mark all as unread for fallback
        seen: bid.seen || false
      }))

      console.log('Processed notifications from bids:', notifications)
      setNotifications(notifications)
    } catch (err) {
      console.error('Error fetching from bids:', err)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      // Update notification as read
      const { error: notificationError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (notificationError) {
        console.error('Error marking notification as read:', notificationError)
        return
      }

      // Also mark the associated bid as seen
      const notification = notifications.find(n => n.notification_id === notificationId)
      if (notification) {
        const { error: bidError } = await supabase
          .from('bids')
          .update({ seen: true })
          .eq('id', notification.id)

        if (bidError) {
          console.error('Error marking bid as seen:', bidError)
        }
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId))
    } catch (err) {
      console.error('Error marking as read:', err)
      // Fallback: remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
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

  const unreadCount = notifications.filter(n => !n.read).length

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
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No new notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : !notification.seen ? 'bg-yellow-50' : ''
                    }`}
                    onClick={() => {
                      // Mark as read if it has a notification_id
                      if (notification.notification_id) {
                        markAsRead(notification.notification_id)
                      }
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
                            markAsRead(notification.id)
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
