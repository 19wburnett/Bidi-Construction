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

    // Refresh session every 10 minutes
    this.refreshInterval = setInterval(async () => {
      if (this.isRefreshing) return

      try {
        this.isRefreshing = true
        const { data: { session }, error } = await this.supabase.auth.getSession()
        
        if (error) {
          console.error('Session refresh error:', error)
          return
        }

        if (session) {
          // Check if session expires within the next 5 minutes
          const expiresAt = new Date(session.expires_at! * 1000)
          const now = new Date()
          const timeUntilExpiry = expiresAt.getTime() - now.getTime()
          
          // If session expires within 5 minutes, refresh it
          if (timeUntilExpiry < 5 * 60 * 1000) {
            console.log('Refreshing session...')
            await this.supabase.auth.refreshSession()
          }
        }
      } catch (err) {
        console.error('Session refresh failed:', err)
      } finally {
        this.isRefreshing = false
      }
    }, 10 * 60 * 1000) // Check every 10 minutes
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
}

