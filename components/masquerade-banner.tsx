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
  }, [])

  const checkMasqueradeStatus = async () => {
    try {
      const response = await fetch('/api/admin/masquerade')
      const data = await response.json()
      setMasqueradeInfo(data)
    } catch (error) {
      console.error('Error checking masquerade status:', error)
    } finally {
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

      if (data.useRedirect && data.redirectUrl) {
        // Fallback: Redirect to magic link
        window.location.href = data.redirectUrl
      } else if (data.session) {
        // Direct session creation - set session client-side
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (sessionError) {
          console.error('Failed to set session:', sessionError)
          alert('Failed to restore admin session. Please try again.')
          setUnmasquerading(false)
          return
        }

        // Wait a bit for cookies to be set, then reload
        await new Promise(resolve => setTimeout(resolve, 500))
        window.location.href = '/admin/demo-settings'
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

  if (loading || !masqueradeInfo?.masquerading) {
    return null
  }

  return (
    <Alert className="bg-yellow-50 border-yellow-200 border-l-4 border-l-yellow-500 rounded-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Masquerading as:</strong> {masqueradeInfo.currentUserEmail || 'Unknown user'}
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
