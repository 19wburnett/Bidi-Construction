'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { ArrowLeft, Bell, X, MapPin, DollarSign, MessageSquare, Calendar } from 'lucide-react'
import Link from 'next/link'

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchNotifications()
  }, [user, router])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    
    const distance = touchStartX.current - touchEndX.current
    const isLeftSwipe = distance > 50

    if (isLeftSwipe) {
      router.back()
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50)

      if (notificationError && notificationError.code === 'PGRST116') {
        // Notifications table doesn't exist, fall back to bids
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
          seen: notif.bids.seen,
          dismissed: notif.dismissed || false
        }))
        setNotifications(notifications)
      } else {
        // No notifications in table, fall back to bids
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
        .limit(50)

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
        seen: bid.seen || false,
        dismissed: false // Mark all as not dismissed for fallback
      }))

      setNotifications(notifications)
    } catch (err) {
      console.error('Error fetching from bids:', err)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      // Find the notification to determine if it has a notification_id
      const notification = notifications.find(n => n.notification_id === notificationId || n.id === notificationId)
      if (!notification) return

      console.log('Marking notification as read:', notification)

      // If it has a notification_id, update the notifications table
      if (notification.notification_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.notification_id)

        if (notificationError) {
          console.error('Error marking notification as read:', notificationError)
          return
        }
        console.log('Successfully marked notification as read in database')
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
      
      console.log('Successfully marked notification as read in local state')
    } catch (err) {
      console.error('Error marking as read:', err)
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

      console.log('Dismissing notification:', notification)

      // If it has a notification_id, update the notifications table
      if (notification.notification_id) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .update({ dismissed: true })
          .eq('id', notification.notification_id)

        if (notificationError) {
          console.error('Error dismissing notification:', notificationError)
          return
        }
        console.log('Successfully dismissed notification in database')
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

  const unreadCount = notifications.filter(n => !n.read).length

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-gray-50 animate-slide-in-right"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <Bell className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold">Notifications</h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {/* Swipe indicator for mobile */}
        <div className="sm:hidden flex justify-center pb-2">
          <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-gray-500">You'll see new bid notifications here when they come in.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.filter(n => !n.dismissed).map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  !notification.read ? 'bg-blue-50 border-blue-200' : !notification.seen ? 'bg-yellow-50 border-yellow-200' : ''
                }`}
                onClick={() => {
                  // Mark as read when clicked
                  markAsRead(notification.notification_id || notification.id)
                  router.push(`/dashboard/jobs/${notification.job_id}`)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          New bid on {notification.job_title}
                        </h3>
                        {!notification.read ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Unread notification"></div>
                        ) : !notification.seen ? (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" title="Unseen bid"></div>
                        ) : null}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 truncate">
                          {notification.subcontractor_name}
                        </p>
                        {notification.bid_amount && (
                          <p className="text-sm font-semibold text-green-600">
                            {formatCurrency(notification.bid_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-3">
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
                        className="p-1 h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
