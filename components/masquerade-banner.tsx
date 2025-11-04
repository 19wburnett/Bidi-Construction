'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { User, X, LogOut } from 'lucide-react'

interface MasqueradeInfo {
  masquerading: boolean
  adminId?: string
  adminEmail?: string
  currentUserId?: string
  currentUserEmail?: string
}

export default function MasqueradeBanner() {
  const [masqueradeInfo, setMasqueradeInfo] = useState<MasqueradeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [unmasquerading, setUnmasquerading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkMasqueradeStatus()
    
    // Check periodically to catch when session becomes available
    const interval = setInterval(() => {
      checkMasqueradeStatus()
    }, 2000) // Check every 2 seconds
    
    return () => clearInterval(interval)
  }, [])

  const checkMasqueradeStatus = async () => {
    try {
      const response = await fetch('/api/admin/masquerade', {
        credentials: 'include' // Important: include cookies
      })
      const data = await response.json()
      
      // Only update if we got valid data
      if (data && typeof data === 'object') {
        setMasqueradeInfo(data)
        // If we found masquerading and have a user email, stop loading
        if (data.masquerading && data.currentUserEmail && data.currentUserEmail !== 'Loading...') {
          setLoading(false)
        } else if (data.masquerading) {
          // Still masquerading but user not loaded yet, keep checking
          setLoading(false) // But don't hide the banner
        } else {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('Error checking masquerade status:', error)
      setLoading(false)
    }
  }

  const handleUnmasquerade = async () => {
    setUnmasquerading(true)
    try {
      const response = await fetch('/api/admin/unmasquerade', {
        method: 'POST',
        credentials: 'include' // Important: include cookies
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        alert('Failed to unmasquerade: ' + (data.error || 'Unknown error'))
        setUnmasquerading(false)
        return
      }

      if (data.success && data.redirectUrl) {
        // Redirect to magic link to restore admin session
        window.location.href = data.redirectUrl
      } else {
        // Refresh the page to update the auth state
        router.refresh()
        window.location.href = '/admin/demo-settings'
      }
    } catch (error) {
      console.error('Error unmasquerading:', error)
      alert('Failed to unmasquerade. Please try again.')
      setUnmasquerading(false)
    }
  }

  // Only show if we're definitely masquerading
  if (!masqueradeInfo?.masquerading) {
    return null
  }

  // Don't show "Loading..." in production - wait for actual email
  const displayEmail = masqueradeInfo.currentUserEmail && masqueradeInfo.currentUserEmail !== 'Loading...' 
    ? masqueradeInfo.currentUserEmail 
    : 'Authenticating...'

  return (
    <Alert className="bg-yellow-50 border-yellow-200 border-l-4 border-l-yellow-500 rounded-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Masquerading as:</strong> {displayEmail}
            {masqueradeInfo.adminEmail && (
              <span className="ml-2 text-sm text-yellow-600">
                (Admin: {masqueradeInfo.adminEmail})
              </span>
            )}
          </AlertDescription>
        </div>
        <Button
          onClick={handleUnmasquerade}
          disabled={unmasquerading}
          size="sm"
          variant="outline"
          className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
        >
          {unmasquerading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
              Returning...
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Return to Admin
            </>
          )}
        </Button>
      </div>
    </Alert>
  )
}
