'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Share2, 
  Copy, 
  Check, 
  Calendar,
  Users,
  Eye,
  Edit,
  MessageSquare,
  Settings,
  Trash2,
  ExternalLink,
  Clock
} from 'lucide-react'
import { modalBackdrop, modalContent, slideInRight, successCheck } from '@/lib/animations'
import { SharePermissions, PlanShare } from '@/types/takeoff'

interface ShareLinkGeneratorProps {
  planId: string
  isOpen: boolean
  onClose: () => void
  onShareCreated?: (share: PlanShare) => void
}

const PERMISSION_OPTIONS = [
  { value: 'view_only', label: 'View Only', icon: Eye, description: 'Can only view the plan' },
  { value: 'markup', label: 'Markup', icon: Edit, description: 'Can view and add markups' },
  { value: 'comment', label: 'Comment', icon: MessageSquare, description: 'Can view and add comments' },
  { value: 'all', label: 'Full Access', icon: Settings, description: 'Can view, markup, and comment' }
]

export default function ShareLinkGenerator({ 
  planId, 
  isOpen, 
  onClose, 
  onShareCreated 
}: ShareLinkGeneratorProps) {
  console.log('ShareLinkGenerator rendered with isOpen:', isOpen)
  
  const [permissions, setPermissions] = useState<SharePermissions>('view_only')
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [hasExpiration, setHasExpiration] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchingExistingShare, setFetchingExistingShare] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedShare, setGeneratedShare] = useState<PlanShare | null>(null)
  const [isExistingShare, setIsExistingShare] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const { user } = useAuth()
  const supabase = createClient()

  // Fetch existing share link when modal opens
  useEffect(() => {
    if (isOpen && planId && user) {
      checkForExistingShare()
    } else {
      // Reset state when modal closes
      setGeneratedShare(null)
      setSuccess(false)
      setIsExistingShare(false)
      setError('')
    }
  }, [isOpen, planId, user])

  const checkForExistingShare = async () => {
    setFetchingExistingShare(true)
    try {
      // Get the most recent share for this plan
      const { data: existingShares, error: fetchError } = await supabase
        .from('plan_shares')
        .select('*')
        .eq('plan_id', planId)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error checking for existing share:', fetchError)
        // Don't show error, just proceed to create new link
        return
      }

      if (existingShares && existingShares.length > 0) {
        // Found an existing share, display it
        const share = existingShares[0]
        // Check if it's expired
        const isExpired = share.expires_at ? new Date(share.expires_at) < new Date() : false
        
        if (!isExpired) {
          setGeneratedShare(share as any)
          setIsExistingShare(true)
          setSuccess(true)
        }
      }
    } catch (err) {
      console.error('Error checking for existing share:', err)
    } finally {
      setFetchingExistingShare(false)
    }
  }

  const generateShareToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  const handleCreateShare = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      // First check if a share already exists for this plan
      const { data: existingShares, error: checkError } = await supabase
        .from('plan_shares')
        .select('*')
        .eq('plan_id', planId)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (checkError) {
        console.error('Error checking existing share:', checkError)
      }

      // If we found an existing share, use it instead of creating a new one
      if (existingShares && existingShares.length > 0) {
        const share = existingShares[0]
        const isExpired = share.expires_at ? new Date(share.expires_at) < new Date() : false
        
        if (!isExpired) {
          setGeneratedShare(share as any)
          setIsExistingShare(true)
          setSuccess(true)
          onShareCreated?.(share as any)
          setLoading(false)
          return
        }
      }

      // No existing share or it's expired, create a new one
      const shareToken = generateShareToken()
      const expiresAtValue = hasExpiration ? new Date(expiresAt).toISOString() : null

      const { data, error: insertError } = await supabase
        .from('plan_shares')
        .insert({
          plan_id: planId,
          share_token: shareToken,
          created_by: user.id,
          permissions: permissions,
          expires_at: expiresAtValue
        })
        .select()
        .single()

      if (insertError) throw insertError

      setGeneratedShare(data)
      setIsExistingShare(false)
      setSuccess(true)
      onShareCreated?.(data)

    } catch (err: any) {
      setError(err.message || 'Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!generatedShare) return

    const shareUrl = `${window.location.origin}/share/plans/${generatedShare.share_token}`
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleClose = () => {
    setSuccess(false)
    setGeneratedShare(null)
    setIsExistingShare(false)
    setError('')
    setCopied(false)
    setPermissions('view_only')
    setExpiresAt('')
    setHasExpiration(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <motion.div
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={handleClose}
      style={{ pointerEvents: 'auto' }}
    >
      <motion.div
        variants={modalContent}
        initial="initial"
        animate="animate"
        exit="exit"
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Share2 className="h-5 w-5 mr-2 text-orange-600" />
                  Share Plan
                </CardTitle>
                <CardDescription>
                  Create a share link for collaboration
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                ×
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {fetchingExistingShare ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-8"
                >
                  <Clock className="h-8 w-8 animate-spin text-gray-400 mb-4" />
                  <p className="text-gray-600">Checking for existing share link...</p>
                </motion.div>
              ) : !success ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Permissions */}
                  <div className="space-y-3">
                    <Label>Access Level</Label>
                    <div className="space-y-2">
                      {PERMISSION_OPTIONS.map((option) => {
                        const Icon = option.icon
                        return (
                          <motion.div
                            key={option.value}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                              <input
                                type="radio"
                                name="permissions"
                                value={option.value}
                                checked={permissions === option.value}
                                onChange={(e) => setPermissions(e.target.value as SharePermissions)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <Icon className="h-4 w-4 mr-2 text-gray-600" />
                                  <span className="font-medium">{option.label}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                              </div>
                            </label>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Expiration */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Set Expiration</Label>
                      <Switch
                        checked={hasExpiration}
                        onCheckedChange={setHasExpiration}
                      />
                    </div>
                    {hasExpiration && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <Input
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <p className="text-xs text-gray-600">
                          Link will expire at this date and time
                        </p>
                      </motion.div>
                    )}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <p className="text-red-600 text-sm">{error}</p>
                    </motion.div>
                  )}

                  {/* Create Button */}
                  <Button 
                    onClick={handleCreateShare}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Creating Share Link...
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-2" />
                        Create Share Link
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-6"
                >
                  {/* Success Animation */}
                  <motion.div
                    variants={successCheck}
                    initial="initial"
                    animate="animate"
                    className="text-center"
                  >
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {isExistingShare ? 'Share Link Found!' : 'Share Link Created!'}
                    </h3>
                    <p className="text-gray-600">
                      {isExistingShare 
                        ? 'Your plan is already shared via the link below'
                        : 'Your plan is now accessible via the link below'}
                    </p>
                  </motion.div>

                  {/* Share Link */}
                  <div className="space-y-3">
                    <Label>Share Link</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/plans/${generatedShare?.share_token}`}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                        className="flex-shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {copied && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-green-600"
                      >
                        Link copied to clipboard!
                      </motion.p>
                    )}
                  </div>

                  {/* Share Details */}
                  <div className="space-y-3">
                    <Label>Share Details</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Access Level:</span>
                        <Badge variant="outline">
                          {PERMISSION_OPTIONS.find(opt => opt.value === permissions)?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Expires:</span>
                        <span className="text-gray-900">
                          {generatedShare?.expires_at 
                            ? new Date(generatedShare.expires_at).toLocaleString()
                            : 'Never'
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Created:</span>
                        <span className="text-gray-900">
                          {new Date().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={handleClose} className="flex-1">
                      Close
                    </Button>
                    <Button 
                      onClick={() => {
                        const shareUrl = `${window.location.origin}/share/plans/${generatedShare?.share_token}`
                        window.open(shareUrl, '_blank')
                      }}
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Link
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

