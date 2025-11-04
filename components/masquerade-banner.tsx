'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, User } from 'lucide-react'

interface MasqueradeState {
  isMasquerading: boolean
  masqueradingAs?: {
    id: string
    email: string
  }
  adminUser?: {
    id: string
    email: string
  }
}

export default function MasqueradeBanner() {
  const [masqueradeState, setMasqueradeState] = useState<MasqueradeState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkMasqueradeStatus()
    // Check periodically
    const interval = setInterval(checkMasqueradeStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkMasqueradeStatus = async () => {
    try {
      const response = await fetch('/api/masquerade')
      if (response.ok) {
        const data = await response.json()
        setMasqueradeState(data)
      }
    } catch (error) {
      console.error('Error checking masquerade status:', error)
    } finally {
      setLoading(false)
    }
  }

  const endMasquerade = async () => {
    try {
      const response = await fetch('/api/masquerade', {
        method: 'DELETE',
      })
      
      if (response.ok) {
        // Refresh the page to clear masquerade state
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to end masquerade: ${error.error}`)
      }
    } catch (error) {
      console.error('Error ending masquerade:', error)
      alert('Failed to end masquerade')
    }
  }

  if (loading || !masqueradeState?.isMasquerading) {
    return null
  }

  return (
    <div className="bg-orange-50 border-b border-orange-200 dark:bg-orange-950/50 dark:border-orange-800 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <div className="text-orange-800 dark:text-orange-200 text-sm">
            <strong>Masquerading as:</strong> {masqueradeState.masqueradingAs?.email || 'Unknown user'}
            {masqueradeState.adminUser && (
              <span className="ml-2 text-xs">
                (Admin: {masqueradeState.adminUser.email})
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={endMasquerade}
          className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
        >
          <X className="h-4 w-4 mr-1" />
          End Masquerade
        </Button>
      </div>
    </div>
  )
}
