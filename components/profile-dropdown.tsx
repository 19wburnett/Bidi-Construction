'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { User, Settings, LogOut, LayoutDashboard } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  avatar_url?: string
  full_name?: string
}

export default function ProfileDropdown() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // Simple check - just get the current user
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          avatar_url: authUser.user_metadata?.picture || authUser.user_metadata?.avatar_url,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name
        })

        // Determine admin status
        const { data: userData } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', authUser.id)
          .single()
        setIsAdmin(!!userData?.is_admin)
      } else {
        setIsAdmin(false)
      }
    }
    getUser()
  }, []) // Remove auth listener to prevent re-renders

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!user) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2"
      >
        {user.avatar_url ? (
          <img
            src={`https://images.weserv.nl/?url=${encodeURIComponent(user.avatar_url)}&w=32&h=32&fit=cover&mask=circle`}
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ${user.avatar_url ? 'hidden' : ''}`}>
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="hidden sm:block text-sm font-medium">
          {user.full_name || user.email}
        </span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border z-20 max-w-[calc(100vw-2rem)]">
            <div className="py-1">
              <div className="px-4 py-2 border-b">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.full_name || 'User'}
                </p>
                <p className="text-sm text-gray-500 truncate" title={user.email}>
                  {user.email}
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/admin/demo-settings')
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Admin Dashboard
                </button>
              )}
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/settings')
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
              
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
