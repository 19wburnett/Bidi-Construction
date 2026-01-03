'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Building2, Menu, X, User, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
const logoPath = '/brand/Bidi Contracting Logo.svg'
import ThemeToggle from '@/components/theme-toggle'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Simple check - just get the current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsSignedIn(!!user)
      
      if (user) {
        // Check if user is admin
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.error('Error checking admin status in navbar:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(userData?.is_admin || false)
        }
      } else {
        setIsAdmin(false)
      }
    }

    getUser()

    // Listen for auth state changes to re-check admin status
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'For Subcontractors', href: '/subcontractors' },
    { name: 'Pricing', href: '/pricing' },
    ...(isSignedIn ? [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Settings', href: '/settings' },
      ...(isAdmin ? [{ name: 'Admin', href: '/admin/demo-settings' }] : [])
    ] : [])
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="border-b-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-black sticky top-0 z-50 shadow-sm transition-colors duration-300">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <img src={logoPath} alt="Bidi Contracting" className="h-8 w-8 sm:h-10 sm:w-10 text-black transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white tracking-tight font-bidi transition-colors duration-300">
                BIDI
              </h1>
              <span className="bidi-orange-bg-light bidi-orange-text dark:bg-orange/20 text-xs font-bold px-3 py-1 rounded-full border border-orange/20 transition-colors duration-300">
                BETA
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-semibold transition-all duration-200 hover:text-black dark:hover:text-white ${
                  isActive(item.href)
                    ? 'text-black dark:text-white border-b-2 border-orange pb-1'
                    : 'text-gray-600 dark:text-gray-300 hover:border-b-2 hover:border-gray-300 dark:hover:border-gray-600 pb-1'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {pathname !== '/' && <ThemeToggle />}
            {isSignedIn ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                  <div className="w-8 h-8 bg-orange rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-200 text-sm font-semibold">
                    {user?.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <Button 
                  variant="construction" 
                  onClick={handleSignOut}
                  className="text-sm"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="construction" className="text-sm">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="orange" className="text-sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t-2 border-gray-200">
            <nav className="flex flex-col space-y-2 pt-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive(item.href)
                      ? 'text-black dark:text-white bg-orange/10 dark:bg-orange/20 border-l-4 border-orange'
                      : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-2">
                {pathname !== '/' && (
                  <div className="flex justify-center mb-2">
                    <ThemeToggle />
                  </div>
                )}
                {isSignedIn ? (
                  <>
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="w-8 h-8 bg-orange rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <span className="text-gray-700 dark:text-gray-200 text-sm font-semibold">
                        {user?.email?.split('@')[0] || 'User'}
                      </span>
                    </div>
                    <Button 
                      variant="construction" 
                      onClick={handleSignOut}
                      className="w-full justify-start text-sm"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="construction" className="w-full justify-start text-sm">
                        Login
                      </Button>
                    </Link>
                    <Link href="/auth/signup" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="orange" className="w-full text-sm">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
