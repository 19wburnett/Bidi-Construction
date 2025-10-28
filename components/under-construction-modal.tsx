'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Construction, Mail, Calendar, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface UnderConstructionModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UnderConstructionModal({ isOpen, onClose }: UnderConstructionModalProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      checkAdminStatus()
    } else {
      setLoading(false)
    }
  }, [user])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } else {
        setIsAdmin(data?.is_admin || false)
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (isAdmin) {
      onClose()
    } else {
      // For non-admin users, close the tab
      window.close()
    }
  }

  const handleEmailClick = () => {
    window.location.href = 'mailto:savewithbidi@gmail.com?subject=Job Request - Under Construction Feature'
  }

  if (loading) {
    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md mx-4"
          >
            <Card className="relative">
              {/* Close button for admins only */}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 z-10"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  <Construction className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Under Construction
                </CardTitle>
                <CardDescription className="text-gray-600">
                  This feature is currently being built and will be available soon!
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Launch date */}
                <div className="flex items-center justify-center space-x-2 text-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-600">
                    Launching November 1st, 2024
                  </span>
                </div>

                {/* Main message */}
                <div className="text-center space-y-3">
                  <p className="text-gray-700">
                    We're working hard to bring you the best job request experience possible. 
                    In the meantime, you can send your job request directly to our team.
                  </p>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      Send your job request to:
                    </p>
                    <Button
                      onClick={handleEmailClick}
                      variant="outline"
                      className="w-full justify-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Mail className="h-4 w-4" />
                      <span>savewithbidi@gmail.com</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col space-y-2">
                  {isAdmin ? (
                    <Button onClick={onClose} className="w-full">
                      Continue as Admin
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleClose} 
                      variant="destructive" 
                      className="w-full"
                    >
                      Close Tab
                    </Button>
                  )}
                </div>

                {/* Admin indicator */}
                {isAdmin && (
                  <div className="text-center">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Admin Mode - You can bypass this restriction
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
