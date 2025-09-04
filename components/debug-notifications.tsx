'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugNotifications() {
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const runDebug = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setDebugData({ error: 'No user logged in' })
        return
      }

      // Check if notifications table exists and has data
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)

      // Check bids for this user
      const { data: bids, error: bidsError } = await supabase
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
        .eq('job_requests.gc_id', user.id)
        .order('created_at', { ascending: false })

      // Check if seen column exists in bids
      const { data: bidsWithSeen, error: seenError } = await supabase
        .from('bids')
        .select('id, seen')
        .limit(1)

      setDebugData({
        user: { id: user.id, email: user.email },
        notifications: {
          data: notifications,
          error: notifError,
          count: notifications?.length || 0
        },
        bids: {
          data: bids,
          error: bidsError,
          count: bids?.length || 0
        },
        seenColumn: {
          data: bidsWithSeen,
          error: seenError
        }
      })
    } catch (err) {
      setDebugData({ error: err })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Debug Notifications</CardTitle>
        <Button onClick={runDebug} disabled={loading}>
          {loading ? 'Running Debug...' : 'Run Debug'}
        </Button>
      </CardHeader>
      <CardContent>
        {debugData && (
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
