'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Search, User, Mail, Calendar, ArrowLeft, LogIn } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import MasqueradeBanner from '@/components/masquerade-banner'
import logo from '../../../public/brand/Bidi Contracting Logo.svg'

interface UserResult {
  id: string
  email: string
  role: string
  created_at: string
}

export default function MasqueradePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [masquerading, setMasquerading] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
    checkMasqueradeStatus()
  }, [user, authLoading, router])

  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers()
    }
  }, [isAdmin])

  const checkAdminStatus = async () => {
    if (!user) return

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
    } catch (err) {
      console.error('Error checking admin status:', err)
      router.push('/dashboard')
    }
  }

  const checkMasqueradeStatus = async () => {
    try {
      const response = await fetch('/api/admin/masquerade')
      const data = await response.json()
      setMasquerading(data.masquerading || false)
    } catch (error) {
      console.error('Error checking masquerade status:', error)
    }
  }

  const fetchAllUsers = async () => {
    setLoading(true)
    setError('')

    try {
      // Fetch all users via API route (bypasses RLS)
      const response = await fetch('/api/admin/users')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  // Client-side filtering for real-time search
  const filteredUsers = users.filter((userResult) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.trim().toLowerCase()
    return (
      userResult.email.toLowerCase().includes(query) ||
      userResult.role.toLowerCase().includes(query)
    )
  })

  const handleMasquerade = async (targetUserId: string, targetEmail: string) => {
    if (!confirm(`Are you sure you want to masquerade as ${targetEmail}?`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/masquerade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId }),
        credentials: 'include' // Important: include cookies
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to masquerade as user')
        setLoading(false)
        return
      }

      if (data.useRedirect && data.redirectUrl) {
        // Fallback: Redirect to the magic link, which will authenticate the user
        // and redirect to the callback page
        window.location.href = data.redirectUrl
      } else if (data.session) {
        // Direct session creation - set session client-side and reload
        const supabase = createClient()
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (sessionError) {
          console.error('Failed to set session:', sessionError)
          setError('Failed to establish session. Please try again.')
          setLoading(false)
          return
        }

        // Wait a bit for cookies to be set, then reload
        await new Promise(resolve => setTimeout(resolve, 500))
        window.location.href = '/dashboard'
      } else {
        setError('Invalid response from masquerade API')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to masquerade as user')
      setLoading(false)
    }
  }

  if (authLoading || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MasqueradeBanner />
      
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src={logo.src} alt="Bidi" className="h-6 w-6 sm:h-8 sm:w-8" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Masquerade</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin/demo-settings">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
                            <CardHeader>
                    <CardTitle>Masquerade as User</CardTitle>
                    <CardDescription>
                      Browse all users or search by email/role. Click "Masquerade" to sign in as them for debugging and support.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Search/Filter Input */}
                    <div className="space-y-2">
                      <Label htmlFor="search">Filter Users</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="search"
                          type="text"
                          placeholder="Search by email or role..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-sm text-gray-500">
                        {loading ? 'Loading users...' : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''} ${searchQuery ? 'found' : 'total'}`}
                      </p>
                    </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

                         {/* Results */}
             {loading ? (
               <div className="text-center py-8">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                 <p className="text-gray-500">Loading users...</p>
               </div>
             ) : filteredUsers.length > 0 ? (
               <div className="space-y-2">
                 <h3 className="font-semibold text-gray-900">Users</h3>
                 <div className="space-y-2 max-h-[600px] overflow-y-auto">
                   {filteredUsers.map((userResult) => (
                    <Card key={userResult.id} className="border-gray-200">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{userResult.email}</span>
                              </div>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                                <span className="capitalize">{userResult.role}</span>
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {new Date(userResult.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleMasquerade(userResult.id, userResult.email)}
                            disabled={loading}
                            variant="default"
                          >
                            {loading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Masquerading...
                              </>
                            ) : (
                              <>
                                <LogIn className="h-4 w-4 mr-2" />
                                Masquerade
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                                     ))}
                 </div>
               </div>
             ) : (
               <div className="text-center py-8 text-gray-500">
                 <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                 <p>
                   {searchQuery 
                     ? `No users found matching "${searchQuery}"`
                     : 'No users found'
                   }
                 </p>
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
