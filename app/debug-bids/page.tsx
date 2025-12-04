'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DebugBidsPage() {
  const [bids, setBids] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchBids = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Get all bids for this user's jobs
      const { data: bidsData, error } = await supabase
        .from('bids')
        .select(`
          id,
          job_id,
          subcontractor_name,
          bid_amount,
          seen,
          created_at,
          jobs!inner(
            id,
            name,
            user_id
          )
        `)
        .eq('jobs.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      console.log('Bids query result:', bidsData)
      console.log('Bids query error:', error)
      
      setBids(bidsData || [])
    } catch (err) {
      console.error('Error fetching bids:', err)
    } finally {
      setLoading(false)
    }
  }

  const testMarkAsSeen = async (bidId: string) => {
    try {
      console.log('Testing mark as seen for bid:', bidId)
      const { error } = await supabase
        .from('bids')
        .update({ seen: true })
        .eq('id', bidId)

      if (error) {
        console.error('Error marking bid as seen:', error)
      } else {
        console.log('Successfully marked bid as seen')
        fetchBids() // Refresh the list
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Debug Bids - Seen Status</CardTitle>
            <Button onClick={fetchBids} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch Bids'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bids.map((bid) => (
                <div key={bid.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p><strong>Bid ID:</strong> {bid.id}</p>
                      <p><strong>Job:</strong> {bid.job_requests?.trade_category}</p>
                      <p><strong>Subcontractor:</strong> {bid.subcontractor_name}</p>
                      <p><strong>Amount:</strong> {bid.bid_amount ? `$${bid.bid_amount}` : 'Not specified'}</p>
                      <p><strong>Seen:</strong> {bid.seen === undefined ? 'Column not found' : bid.seen ? 'Yes' : 'No'}</p>
                      <p><strong>Created:</strong> {new Date(bid.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      {bid.seen !== undefined && !bid.seen && (
                        <Button 
                          size="sm" 
                          onClick={() => testMarkAsSeen(bid.id)}
                        >
                          Mark as Seen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
