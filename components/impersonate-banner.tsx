'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { User, X } from 'lucide-react'

interface ImpersonateInfo {
  impersonating: boolean
  adminId?: string
  adminEmail?: string
  currentUserId?: string
  currentUserEmail?: string
}

export default function ImpersonateBanner() {
  const [info, setInfo] = useState<ImpersonateInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    checkImpersonateStatus()
  }, [])

  const checkImpersonateStatus = async () => {
    try {
      const response = await fetch('/api/admin/impersonate', {
        credentials: 'include'
      })
      const data = await response.json()
      setInfo(data)
    } catch (error) {
      console.error('Error checking impersonate status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEndImpersonate = async () => {
    setEnding(true)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        // Refresh page
        window.location.reload()
      }
    } catch (error) {
      console.error('Error ending impersonate:', error)
      setEnding(false)
    }
  }

  if (loading || !info?.impersonating) {
    return null
  }

  return (
    <Alert className="bg-yellow-50 border-yellow-200 border-l-4 border-l-yellow-500 rounded-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Impersonating:</strong> {info.currentUserEmail || 'Loading...'}
            {info.adminEmail && (
              <span className="ml-2 text-sm text-yellow-600">
                (Admin: {info.adminEmail})
              </span>
            )}
          </AlertDescription>
        </div>
        <Button
          onClick={handleEndImpersonate}
          disabled={ending}
          size="sm"
          variant="outline"
          className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
        >
          {ending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
              Ending...
            </>
          ) : (
            <>
              <X className="h-4 w-4 mr-2" />
              End Impersonation
            </>
          )}
        </Button>
      </div>
    </Alert>
  )
}

