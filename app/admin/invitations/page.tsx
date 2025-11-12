'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers'
import { createClient } from '@/lib/supabase'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clipboard, Check, Trash2, Users as UsersIcon, MailPlus, RefreshCcw, AlertCircle } from 'lucide-react'

interface Invitation {
  id: string
  email: string
  token: string
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  role: 'owner' | 'collaborator'
  expires_at: string | null
  accepted_at: string | null
  created_at: string
  jobs: Array<{ id: string; name: string }>
}

interface AdminJob {
  id: string
  name: string
  status: string | null
}

interface AdminUser {
  id: string
  email: string
  subscription_status: string | null
  is_admin: boolean
}

interface JobMember {
  job_id: string
  user_id: string
  role: string
}

interface AdminDataResponse {
  success: boolean
  invitations: Invitation[]
  jobs: AdminJob[]
  users: AdminUser[]
  jobMembers: JobMember[]
  invitationBaseUrl?: string | null
}

export default function AdminInvitationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; variant: 'default' | 'destructive' } | null>(null)
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [jobMembers, setJobMembers] = useState<JobMember[]>([])
  const [invitationBaseUrl, setInvitationBaseUrl] = useState<string | undefined>(undefined)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'collaborator'>('collaborator')
  const [expiresInDays, setExpiresInDays] = useState<number>(7)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [creatingInvitation, setCreatingInvitation] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  const [userSelections, setUserSelections] = useState<Record<string, string[]>>({})
  const [initialSelections, setInitialSelections] = useState<Record<string, string[]>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [filterUsers, setFilterUsers] = useState('')

  const showNotification = (message: string, variant: 'default' | 'destructive' = 'default') => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
    }
    setNotification({ message, variant })
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null)
      notificationTimeoutRef.current = null
    }, 4000)
  }

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (authLoading) return

    const verifyAdmin = async () => {
      if (!user) {
        router.push('/auth/login')
        return
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (error || !data?.is_admin) {
          router.push('/dashboard')
          return
        }

        setIsAdmin(true)
        await loadAdminData()
      } catch (err) {
        console.error('Error verifying admin status:', err)
        setError('Failed to verify admin access')
      } finally {
        setLoading(false)
      }
    }

    verifyAdmin()
  }, [authLoading, user, router, supabase])

  const loadAdminData = async (showSpinner: boolean = true) => {
    try {
      if (showSpinner) {
        setLoading(true)
      }
      setError(null)

      const response = await fetch('/api/admin/invitations', { cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load admin data')
      }

      const data = (await response.json()) as AdminDataResponse
      setInvitations(data.invitations)
      setJobs(data.jobs)
      setUsers(data.users)
      setJobMembers(data.jobMembers)
      setInvitationBaseUrl(data.invitationBaseUrl || undefined)

      const membershipMap: Record<string, string[]> = {}
      data.users.forEach((adminUser) => {
        membershipMap[adminUser.id] = data.jobMembers
          .filter((member) => member.user_id === adminUser.id)
          .map((member) => member.job_id)
      })

      setUserSelections(membershipMap)
      setInitialSelections(membershipMap)
    } catch (err) {
      console.error('Error loading admin invitation data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load admin invitation data')
    } finally {
      if (showSpinner) {
        setLoading(false)
      }
    }
  }

  const handleJobToggleForInvitation = (jobId: string, checked: boolean) => {
    setSelectedJobs((prev) => {
      if (checked) {
        if (prev.includes(jobId)) return prev
        return [...prev, jobId]
      }
      return prev.filter((id) => id !== jobId)
    })
  }

  const handleCreateInvitation = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!email) {
      showNotification('Email is required', 'destructive')
      return
    }

    setCreatingInvitation(true)
    setGeneratedLink(null)

    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          jobIds: selectedJobs,
          expiresInDays,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create invitation')
      }

      setGeneratedLink(data.invitation?.invitationUrl || null)
      showNotification('Invitation created successfully')
      setEmail('')
      setSelectedJobs([])
      setExpiresInDays(7)
      setRole('collaborator')
      await loadAdminData(false)
    } catch (err) {
      console.error('Error creating invitation:', err)
      showNotification(
        err instanceof Error ? err.message : 'Failed to create invitation',
        'destructive'
      )
    } finally {
      setCreatingInvitation(false)
    }
  }

  const handleCopyLink = async (token: string) => {
    const base =
      invitationBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : '')

    const link = `${base.replace(/\/$/, '')}/invite/${token}`

    try {
      await navigator.clipboard.writeText(link)
      showNotification('Invitation link copied to clipboard')
    } catch (err) {
      console.error('Copy failed:', err)
      showNotification('Failed to copy link', 'destructive')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Cancel this invitation? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel invitation')
      }

      showNotification('Invitation cancelled')
      await loadAdminData(false)
    } catch (err) {
      console.error('Error cancelling invitation:', err)
      showNotification(
        err instanceof Error ? err.message : 'Failed to cancel invitation',
        'destructive'
      )
    }
  }

  const toggleUserJobSelection = (userId: string, jobId: string, checked: boolean) => {
    setUserSelections((prev) => {
      const existing = prev[userId] ? [...prev[userId]!] : []
      const index = existing.indexOf(jobId)
      if (checked) {
        if (index === -1) {
          existing.push(jobId)
        }
      } else if (index !== -1) {
        existing.splice(index, 1)
      }
      return {
        ...prev,
        [userId]: existing,
      }
    })
  }

  const selectionChanged = (userId: string) => {
    const currentList = userSelections[userId] || []
    const initialList = initialSelections[userId] || []

    if (currentList.length !== initialList.length) {
      return true
    }

    const lookup: Record<string, boolean> = {}
    for (let i = 0; i < currentList.length; i += 1) {
      lookup[currentList[i]] = true
    }

    for (let i = 0; i < initialList.length; i += 1) {
      if (!lookup[initialList[i]]) {
        return true
      }
    }

    return false
  }

  const handleSaveUserJobs = async (userId: string) => {
    setSavingUserId(userId)
    try {
      const response = await fetch('/api/admin/job-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          jobIds: userSelections[userId] || [],
          role: 'collaborator',
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update job assignments')
      }

      showNotification('Job access updated')
      setInitialSelections((prev) => ({
        ...prev,
        [userId]: [...(userSelections[userId] || [])],
      }))
      await loadAdminData()
    } catch (err) {
      console.error('Error saving job assignments:', err)
      showNotification(
        err instanceof Error ? err.message : 'Failed to update job assignments',
        'destructive'
      )
    } finally {
      setSavingUserId(null)
    }
  }

  const filteredInvitations = useMemo(
    () => invitations.filter((invite) => invite.status === 'pending'),
    [invitations]
  )

  const filteredUsers = useMemo(() => {
    const query = filterUsers.trim().toLowerCase()
    if (!query) return users
    return users.filter((u) => u.email.toLowerCase().includes(query))
  }, [users, filterUsers])

  const ownerAssignmentMap = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    jobMembers.forEach((member) => {
      if (member.role === 'owner') {
        if (!map[member.user_id]) {
          map[member.user_id] = new Set<string>()
        }
        map[member.user_id]!.add(member.job_id)
      }
    })
    return map
  }, [jobMembers])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Team Invitations & Access
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Invite collaborators and manage their job access.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadAdminData()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {notification && (
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              notification.variant === 'destructive'
                ? 'border-red-500/40 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-200'
                : 'border-green-500/40 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-200'
            }`}
          >
            {notification.variant === 'destructive' ? (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Check className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {error && (
          <Card className="border-red-500/40 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-300">Error</CardTitle>
              <CardDescription className="text-red-600 dark:text-red-200">{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailPlus className="h-5 w-5 text-orange-500" />
              Create Invitation
            </CardTitle>
            <CardDescription>
              Generate a link that lets collaborators create an account and get immediate access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateInvitation} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={role} onValueChange={(value: 'owner' | 'collaborator') => setRole(value)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="collaborator">Collaborator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-expires">Expires in (days)</Label>
                  <Input
                    id="invite-expires"
                    type="number"
                    min={1}
                    max={90}
                    value={expiresInDays}
                    onChange={(event) => setExpiresInDays(Number(event.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job Access</Label>
                  <div className="rounded-md border p-3 max-h-52 overflow-y-auto space-y-2">
                    {jobs.length === 0 && (
                      <p className="text-sm text-gray-500">No jobs available yet.</p>
                    )}
                    {jobs.map((job) => (
                      <label key={job.id} className="flex items-center space-x-2 text-sm">
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={(checked) =>
                            handleJobToggleForInvitation(job.id, Boolean(checked))
                          }
                        />
                        <span className="text-gray-700 dark:text-gray-200">{job.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {generatedLink && (
                <div className="rounded border border-green-500/40 bg-green-50 dark:bg-green-950/20 p-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-green-700 dark:text-green-200 break-all">{generatedLink}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink).then(() =>
                        showNotification('Invitation link copied to clipboard')
                      )
                    }}
                  >
                    <Clipboard className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              )}
              <Button type="submit" variant="orange" disabled={creatingInvitation}>
                {creatingInvitation ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </span>
                ) : (
                  'Create Invitation'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Share these links with collaborators. You can cancel an invitation at any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredInvitations.length === 0 ? (
              <p className="text-sm text-gray-500">No pending invitations.</p>
            ) : (
              <div className="space-y-3">
                {filteredInvitations.map((invitation) => {
                  const base =
                    invitationBaseUrl ||
                    (typeof window !== 'undefined' ? window.location.origin : '')
                  const shareUrl = `${base.replace(/\/$/, '')}/invite/${invitation.token}`
                  return (
                    <div
                      key={invitation.id}
                      className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{invitation.email}</p>
                          <Badge variant={invitation.role === 'owner' ? 'default' : 'outline'}>
                            {invitation.role}
                          </Badge>
                        </div>
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
                        <p className="text-xs text-gray-500">
                          Created {new Date(invitation.created_at).toLocaleString()}
                          {invitation.expires_at && (
                            <> · Expires {new Date(invitation.expires_at).toLocaleString()}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(invitation.token)}
                        >
                          <Clipboard className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-orange-500" />
              User Job Access
            </CardTitle>
            <CardDescription>
              Assign jobs to existing users. Collaborators automatically see jobs you add here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="md:w-1/3 space-y-2">
              <Label htmlFor="user-filter">Filter users</Label>
              <Input
                id="user-filter"
                placeholder="Search by email"
                value={filterUsers}
                onChange={(event) => setFilterUsers(event.target.value)}
              />
            </div>

            {filteredUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No users found.</p>
            ) : (
              <div className="grid gap-4">
                {filteredUsers.map((adminUser) => {
                  const assignments = new Set(userSelections[adminUser.id] || [])
                  const ownerJobs = ownerAssignmentMap[adminUser.id] || new Set<string>()
                  const isDirty = selectionChanged(adminUser.id)
                  return (
                    <div
                      key={adminUser.id}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{adminUser.email}</p>
                          <p className="text-xs text-gray-500">
                            Subscription: {adminUser.subscription_status || 'inactive'}
                            {adminUser.is_admin && ' · Admin'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!isDirty || savingUserId === adminUser.id}
                            onClick={() => handleSaveUserJobs(adminUser.id)}
                          >
                            {savingUserId === adminUser.id ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving…
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Check className="h-4 w-4" />
                                Save Changes
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-2">
                        {jobs.map((job) => (
                          <label key={job.id} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={assignments.has(job.id)}
                              disabled={ownerJobs.has(job.id)}
                              onCheckedChange={(checked) =>
                                toggleUserJobSelection(adminUser.id, job.id, Boolean(checked))
                              }
                            />
                            <span className="text-gray-700 dark:text-gray-200">{job.name}</span>
                            {ownerJobs.has(job.id) && (
                              <Badge variant="outline" className="ml-auto text-xs">
                                Owner
                              </Badge>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

