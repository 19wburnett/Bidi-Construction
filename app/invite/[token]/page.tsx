'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react'

interface InvitationDetails {
  id: string
  email: string
  role: 'owner' | 'collaborator'
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  expires_at: string | null
  accepted_at: string | null
  created_at: string
  jobs: Array<{ id: string; name: string }>
}

export default function InvitationSignupPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/invitations/${encodeURIComponent(params.token)}`, { cache: 'no-store' })
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load invitation')
        }

        setInvitation(data.invitation)
        setEmail(data.invitation.email)
      } catch (err) {
        console.error('Error loading invitation:', err)
        setError(err instanceof Error ? err.message : 'Failed to load invitation')
      } finally {
        setLoading(false)
      }
    }

    if (params.token) {
      loadInvitation()
    }
  }, [params.token])

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!invitation) return
    if (invitation.status !== 'pending') {
      setError(`This invitation is already ${invitation.status}.`)
      return
    }

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    try {
      setAccepting(true)
      setError(null)

      const response = await fetch(`/api/invitations/${encodeURIComponent(params.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.warn('User created but automatic sign-in failed:', signInError.message)
      }

      setSuccess(true)

      setTimeout(() => {
        router.push('/dashboard/jobs')
      }, 1500)
    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <Card className="max-w-md border-red-500/40 bg-red-50 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              Invitation not found
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-600 dark:text-red-200">
            This invitation link is invalid or has already been used.
          </CardContent>
        </Card>
      </div>
    )
  }

  const isExpired = invitation.expires_at
    ? new Date(invitation.expires_at) < new Date()
    : false

  const isInactive = invitation.status !== 'pending' || isExpired

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">You&apos;re invited to Bidi</CardTitle>
          <CardDescription>
            Complete your account to access assigned jobs immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-gray-50 dark:bg-gray-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Invited email</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{invitation.email}</p>
              </div>
              <Badge variant={invitation.role === 'owner' ? 'default' : 'outline'}>
                {invitation.role}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Jobs access</p>
              <div className="flex flex-wrap gap-2">
                {invitation.jobs.length > 0 ? (
                  invitation.jobs.map((job) => (
                    <Badge key={job.id} variant="secondary">
                      {job.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">No jobs assigned yet</span>
                )}
              </div>
            </div>
            {invitation.expires_at && (
              <p className="text-xs text-gray-500">
                Expires on {new Date(invitation.expires_at).toLocaleString()}
              </p>
            )}
            {isInactive && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                {isExpired ? 'This invitation has expired.' : `This invitation is ${invitation.status}.`}
              </div>
            )}
          </div>

          {success ? (
            <div className="rounded-lg border border-green-500/40 bg-green-50 dark:bg-green-950/20 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-200">Account created!</p>
                <p className="text-sm text-green-600 dark:text-green-200">
                  Redirecting you to your dashboard…
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isInactive}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a strong password"
                  disabled={isInactive}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirm-password">Confirm password</Label>
                <Input
                  id="invite-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isInactive}
                  required
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={accepting || isInactive}
              >
                {accepting ? (
                  <span className="flex items-center gap-2">
                    <FallingBlocksLoader size="sm" text="" />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Create account & sign in
                  </span>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

