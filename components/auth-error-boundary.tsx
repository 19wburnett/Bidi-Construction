'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface AuthErrorBoundaryProps {
  children: ReactNode
}

interface AuthErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export default class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add error monitoring service integration
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <CardTitle className="text-red-600">Authentication Error</CardTitle>
              </div>
              <CardDescription>
                Something went wrong with the authentication system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Please try refreshing the page or contact support if the problem persists.
              </p>
              <div className="flex space-x-2">
                <Button onClick={this.handleRetry} variant="outline" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={() => window.location.href = '/auth/login'} 
                  className="flex-1"
                >
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
