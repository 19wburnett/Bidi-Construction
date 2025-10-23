'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Users, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

// Dynamically import the annotator to avoid SSR issues
const GuestPlanAnnotator = dynamic(() => import('@/components/guest-plan-annotator'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <FallingBlocksLoader />
    </div>
  )
})

interface ShareInfo {
  plan: {
    id: string
    title: string
    fileName: string
    fileUrl: string
  }
  permissions: {
    allowComments: boolean
    allowDrawings: boolean
  }
  ownerName: string
}

interface GuestUser {
  id: string
  name: string
  email?: string
  sessionToken: string
}

export default function SharedPlanPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null)
  const [showNameForm, setShowNameForm] = useState(false)
  
  // Name form state
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [submittingName, setSubmittingName] = useState(false)

  // Check for existing guest session
  useEffect(() => {
    checkExistingSession()
  }, [])

  // Validate share token
  useEffect(() => {
    if (!showNameForm && guestUser) {
      validateShareToken()
    } else if (!showNameForm && !guestUser) {
      // No session yet, show loading until we check
      setLoading(true)
    }
  }, [token, guestUser, showNameForm])

  async function checkExistingSession() {
    try {
      // Check if guest_name cookie exists (client-side check)
      const guestNameCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('guest_name='))
        ?.split('=')[1]

      if (guestNameCookie) {
        // Validate session with server
        const response = await fetch('/api/plan/share/guest-session')
        const data = await response.json()

        if (data.success && data.guestUser) {
          setGuestUser(data.guestUser)
          setShowNameForm(false)
          return
        }
      }

      // No valid session, show name form
      setShowNameForm(true)
      setLoading(false)

    } catch (error) {
      console.error('Error checking session:', error)
      setShowNameForm(true)
      setLoading(false)
    }
  }

  async function validateShareToken() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/plan/share/${token}`)
      const data = await response.json()

      if (!response.ok || !data.valid) {
        setError(data.error || 'This share link is invalid or has expired')
        setLoading(false)
        return
      }

      setShareInfo(data)
      setLoading(false)

    } catch (error) {
      console.error('Error validating share token:', error)
      setError('Failed to load shared plan. Please try again.')
      setLoading(false)
    }
  }

  async function handleSubmitName(e: React.FormEvent) {
    e.preventDefault()

    if (!guestName.trim()) {
      alert('Please enter your name')
      return
    }

    setSubmittingName(true)

    try {
      const response = await fetch('/api/plan/share/guest-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: guestName.trim(),
          email: guestEmail.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create session')
      }

      setGuestUser(data.guestUser)
      setShowNameForm(false)
      // Will trigger validation in useEffect

    } catch (error) {
      console.error('Error creating guest session:', error)
      alert('Failed to create session. Please try again.')
    } finally {
      setSubmittingName(false)
    }
  }

  // Show name entry form
  if (showNameForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-4 rounded-full">
                <FileText className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome to Bidi</CardTitle>
            <CardDescription className="text-base">
              You've been invited to collaborate on construction plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitName} className="space-y-4">
              <div>
                <Label htmlFor="guestName">Your Name *</Label>
                <Input
                  id="guestName"
                  type="text"
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  className="mt-1"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your name will be shown on comments and drawings you make
                </p>
              </div>

              <div>
                <Label htmlFor="guestEmail">Email (optional)</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional - for notifications about updates
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={submittingName}
              >
                {submittingName ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Continue to Plans
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                We'll save your session for 7 days so you don't have to re-enter your name
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FallingBlocksLoader />
      </div>
    )
  }

  // Show error state
  if (error || !shareInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 p-4 rounded-full">
                <AlertTriangle className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-2xl">Link Not Available</CardTitle>
            <CardDescription className="text-base">
              {error || 'This share link is invalid or has expired'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This could happen if:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-6">
              <li>The link has expired</li>
              <li>The link was deactivated by the owner</li>
              <li>The link URL is incorrect</li>
            </ul>
            <Button 
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Go to Bidi Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show plan annotator
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-2 rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {shareInfo.plan.title || shareInfo.plan.fileName}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Shared by {shareInfo.ownerName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="flex items-center">
                <Users className="h-3 w-3 mr-1" />
                {guestUser?.name}
              </Badge>
              
              {shareInfo.permissions.allowComments && (
                <Badge variant="secondary" className="flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Comments Enabled
                </Badge>
              )}
              
              {shareInfo.permissions.allowDrawings && (
                <Badge variant="secondary" className="flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Drawings Enabled
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Plan Annotator */}
      <GuestPlanAnnotator
        planId={shareInfo.plan.id}
        planFile={shareInfo.plan.fileUrl}
        planFileName={shareInfo.plan.fileName}
        guestUser={guestUser!}
        allowComments={shareInfo.permissions.allowComments}
        allowDrawings={shareInfo.permissions.allowDrawings}
      />
    </div>
  )
}



