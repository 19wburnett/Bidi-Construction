'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { X, User } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface MasqueradeStatus {
  isMasquerading: boolean
  originalAdminId: string | null
  targetUserId: string | null
  targetUserEmail: string | null
}

export default function MasqueradeBanner() {
  const [status, setStatus] = useState<MasqueradeStatus>({
    isMasquerading: false,
    originalAdminId: null,
    targetUserId: null,
    targetUserEmail: null,
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/admin/masquerade/status')
        const data = await response.json()
        setStatus(data)
      } catch (error) {
        console.error('Error checking masquerade status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
    
    // Poll for status changes every 2 seconds
    const interval = setInterval(checkStatus, 2000)
    
    return () => clearInterval(interval)
  }, [])

  const handleStopMasquerade = async () => {
    try {
      const response = await fetch('/api/admin/masquerade/stop', {
        method: 'POST',
      })

      if (response.ok) {
        // Refresh the page to reset auth state
        router.refresh()
        window.location.reload()
      } else {
        console.error('Failed to stop masquerade')
      }
    } catch (error) {
      console.error('Error stopping masquerade:', error)
    }
  }

  if (loading || !status.isMasquerading) {
    return null
  }

  return (
    <Alert className="bg-yellow-50 border-yellow-200 border-l-4 border-l-yellow-500 rounded-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Masquerading as:</strong> {status.targetUserEmail || 'Unknown User'}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStopMasquerade}
          className="text-yellow-800 hover:text-yellow-900 hover:bg-yellow-100"
        >
          <X className="h-4 w-4 mr-1" />
          Stop Masquerading
        </Button>
      </div>
    </Alert>
  )
}





