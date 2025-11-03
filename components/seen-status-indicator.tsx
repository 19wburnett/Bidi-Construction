'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff } from 'lucide-react'

interface SeenStatusIndicatorProps {
  jobId: string
  refreshTrigger?: number
}

export default function SeenStatusIndicator({ jobId, refreshTrigger }: SeenStatusIndicatorProps) {
  const [seenStatus, setSeenStatus] = useState<{ [bidId: string]: boolean }>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchSeenStatus()
  }, [jobId, refreshTrigger])

  const fetchSeenStatus = async () => {
    try {
      console.log('Fetching seen status for job:', jobId)
      const { data: bids, error } = await supabase
        .from('bids')
        .select('id, seen')
        .or(`job_id.eq.${jobId},job_request_id.eq.${jobId}`)

      console.log('Seen status query result:', bids)
      console.log('Seen status query error:', error)

      if (error) {
        console.error('Error fetching seen status:', error)
        return
      }

      const status: { [bidId: string]: boolean } = {}
      bids?.forEach(bid => {
        status[bid.id] = bid.seen || false
        console.log(`Bid ${bid.id}: seen = ${bid.seen}`)
      })

      console.log('Processed seen status:', status)
      setSeenStatus(status)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Badge variant="outline">Loading...</Badge>
  }

  const unseenCount = Object.values(seenStatus).filter(seen => !seen).length
  const totalCount = Object.keys(seenStatus).length

  if (totalCount === 0) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      {unseenCount > 0 ? (
        <Badge variant="destructive" className="flex items-center space-x-1">
          <EyeOff className="h-3 w-3" />
          <span>{unseenCount} unseen</span>
        </Badge>
      ) : (
        <Badge variant="secondary" className="flex items-center space-x-1">
          <Eye className="h-3 w-3" />
          <span>All seen</span>
        </Badge>
      )}
      <button 
        onClick={fetchSeenStatus}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
        title="Refresh status"
      >
        Refresh
      </button>
      <button 
        onClick={async () => {
          console.log('Testing direct bid update...')
          
          // Try updating the specific bid we know exists
          const bidId = 'dd1d6342-0932-4b6a-a6d8-a03a1d9ecc8a'
          console.log('Updating bid:', bidId)
          
          const { data, error } = await supabase
            .from('bids')
            .update({ seen: true })
            .eq('id', bidId)
            .select('id, seen, job_request_id')
          
          console.log('Direct update result:', data)
          console.log('Direct update error:', error)
          
          // Also try updating by job_request_id
          console.log('Trying update by job_request_id:', jobId)
          const { data: data2, error: error2 } = await supabase
            .from('bids')
            .update({ seen: true })
            .or(`job_id.eq.${jobId},job_request_id.eq.${jobId}`)
            .select('id, seen, job_request_id')
          
          console.log('Job ID update result:', data2)
          console.log('Job ID update error:', error2)
          
          fetchSeenStatus()
        }}
        className="text-xs text-green-600 hover:text-green-800 underline ml-2"
        title="Test update"
      >
        Test Update
      </button>
      <button 
        onClick={async () => {
          console.log('Debugging all bids in database...')
          const { data: allBids, error } = await supabase
            .from('bids')
            .select('id, job_request_id, seen, subcontractor_email, subcontractors (name, email)')
            .limit(10)
          console.log('All bids in database:', allBids)
          console.log('All bids error:', error)
        }}
        className="text-xs text-purple-600 hover:text-purple-800 underline ml-2"
        title="Debug all bids"
      >
        Debug All
      </button>
      <button 
        onClick={async () => {
          console.log('Testing permissions...')
          
          // Check if we can read the bid
          const { data: readData, error: readError } = await supabase
            .from('bids')
            .select('*')
            .eq('id', 'dd1d6342-0932-4b6a-a6d8-a03a1d9ecc8a')
          
          console.log('Read permission test:', readData, readError)
          
          // Check current user
          const { data: { user } } = await supabase.auth.getUser()
          console.log('Current user:', user?.id)
          
          // Try a simple update without select
          const { error: updateError } = await supabase
            .from('bids')
            .update({ seen: true })
            .eq('id', 'dd1d6342-0932-4b6a-a6d8-a03a1d9ecc8a')
          
          console.log('Update permission test (no select):', updateError)
        }}
        className="text-xs text-orange-600 hover:text-orange-800 underline ml-2"
        title="Test permissions"
      >
        Test Perms
      </button>
    </div>
  )
}
