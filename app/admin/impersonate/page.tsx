'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Search, User, Loader2 } from 'lucide-react'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

export default function ImpersonatePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [users, setUsers] = useState<Array<{ id: string; email: string; is_admin: boolean }>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const { user } = useAuth()

  useEffect(() => {
    checkAdminStatus()
  }, [user])

  const checkAdminStatus = async () => {
    if (!user) {
      setAuthLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setIsAdmin(data?.is_admin || false)
      
      if (data?.is_admin) {
        loadUsers()
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
    } finally {
      setAuthLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, is_admin')
        .order('email', { ascending: true })
        .limit(100)

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const handleImpersonate = async (targetEmail?: string) => {
    const targetEmailToUse = targetEmail || email.trim()
    
    if (!targetEmailToUse) {
      setError('Please enter an email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        redirect: 'manual', // Don't follow redirects automatically
        body: JSON.stringify({ email: targetEmailToUse })
      })

      // Check if it's a redirect (3xx status)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get('Location')
        if (redirectUrl) {
          // Follow the redirect manually
          window.location.href = redirectUrl
          return
        }
      }

      // If not a redirect, check for errors
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start impersonation')
      }
      
      // If we get here, something went wrong
      const data = await response.json()
      setError(data.error || 'Failed to start impersonation')
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to start impersonation')
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FallingBlocksLoader text="Loading..." size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be an admin to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Impersonate User</CardTitle>
            <CardDescription>
              Enter a user's email to impersonate their account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleImpersonate()
                    }
                  }}
                  disabled={loading}
                />
                <Button
                  onClick={() => handleImpersonate()}
                  disabled={loading || !email.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Impersonate'
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2 mb-4">
                <Label htmlFor="search">Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => handleImpersonate(user.email)}
                  >
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{user.email}</span>
                      {user.is_admin && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleImpersonate(user.email)
                      }}
                      disabled={loading}
                    >
                      Impersonate
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


