import { createClient } from '@/lib/supabase'

export class AuthUtils {
  private static supabase = createClient()
  private static refreshInterval: NodeJS.Timeout | null = null
  private static isRefreshing = false

  /**
   * Start automatic session refresh
   * This helps prevent session timeouts by refreshing tokens before they expire
   */
  static startSessionRefresh() {
    if (this.refreshInterval) {
      return // Already started
    }

    console.log('Starting automatic session refresh...')

    // Refresh session every 5 minutes for more frequent checks
    this.refreshInterval = setInterval(async () => {
      if (this.isRefreshing) return

      try {
        this.isRefreshing = true
        const { data: { session }, error } = await this.supabase.auth.getSession()
        
        if (error) {
          console.error('Session refresh check error:', error)
          // If we can't get the session, stop the refresh interval
          this.stopSessionRefresh()
          return
        }

        if (session) {
          // Check if session expires within the next 10 minutes
          const expiresAt = new Date(session.expires_at! * 1000)
          const now = new Date()
          const timeUntilExpiry = expiresAt.getTime() - now.getTime()
          
          // If session expires within 10 minutes, refresh it
          if (timeUntilExpiry < 10 * 60 * 1000) {
            console.log('Session expires soon, refreshing...')
            const { data, error: refreshError } = await this.supabase.auth.refreshSession()
            
            if (refreshError) {
              console.error('Session refresh failed:', refreshError)
              // If refresh fails, stop the interval - user may need to login again
              this.stopSessionRefresh()
            } else {
              console.log('Session refreshed successfully')
            }
          } else {
            console.log('Session is still valid, no refresh needed')
          }
        } else {
          console.log('No active session found')
          this.stopSessionRefresh()
        }
      } catch (err) {
        console.error('Session refresh failed:', err)
        this.stopSessionRefresh()
      } finally {
        this.isRefreshing = false
      }
    }, 5 * 60 * 1000) // Check every 5 minutes
  }

  /**
   * Stop automatic session refresh
   */
  static stopSessionRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }

  /**
   * Manually refresh the current session
   */
  static async refreshSession() {
    try {
      const { data, error } = await this.supabase.auth.refreshSession()
      if (error) {
        console.error('Manual session refresh error:', error)
        return { success: false, error }
      }
      return { success: true, session: data.session }
    } catch (err) {
      console.error('Manual session refresh failed:', err)
      return { success: false, error: err }
    }
  }

  /**
   * Check if the current session is valid
   */
  static async isSessionValid(): Promise<boolean> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession()
      return !error && !!session && new Date(session.expires_at! * 1000) > new Date()
    } catch (err) {
      console.error('Session validation error:', err)
      return false
    }
  }

  /**
   * Get a valid session, refreshing if necessary
   * This is useful for API routes that need to ensure they have a valid session
   */
  static async getValidSession() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session:', error)
        return { session: null, error }
      }

      if (!session) {
        return { session: null, error: new Error('No session found') }
      }

      // Check if session is expired or will expire soon
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      
      // If session expires within 5 minutes, try to refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log('Session expires soon, attempting refresh...')
        const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession()
        
        if (refreshError) {
          console.error('Session refresh failed:', refreshError)
          return { session: null, error: refreshError }
        }
        
        return { session: refreshData.session, error: null }
      }

      return { session, error: null }
    } catch (err) {
      console.error('Session validation error:', err)
      return { session: null, error: err }
    }
  }
}





