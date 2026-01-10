'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { Save, User, Phone, Bell, CreditCard, Coins, ListChecks, FileText, Mail, ChevronRight } from 'lucide-react'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import DocumentTemplatesManager from '@/components/document-templates-manager'
import EmailTemplatesManager from '@/components/email-templates-manager'
import CustomCostCodesManager from '@/components/custom-cost-codes-manager'
import { AVAILABLE_STANDARDS, CostCodeStandard, getStandardName } from '@/lib/cost-code-helpers'
import { cn } from '@/lib/utils'

interface UserSettings {
  first_name: string
  last_name: string
  phone: string
  email_notifications: boolean
  bid_notifications: boolean
  marketing_emails: boolean
  payment_type: 'subscription' | 'credits' | 'pay_per_job'
  subscription_status: string
  credits: number
  preferred_cost_code_standard: CostCodeStandard
}

type SettingsSection = 'personal' | 'preferences' | 'notifications' | 'payment' | 'documents' | 'emails'

interface SettingsNavItem {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const settingsNavItems: SettingsNavItem[] = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'preferences', label: 'Preferences', icon: ListChecks },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'documents', label: 'Document Templates', icon: FileText },
  { id: 'emails', label: 'Email Templates', icon: Mail },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    first_name: '',
    last_name: '',
    phone: '',
    email_notifications: true,
    bid_notifications: true,
    marketing_emails: false,
    payment_type: 'subscription',
    subscription_status: 'inactive',
    credits: 0,
    preferred_cost_code_standard: 'csi-16'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [newPaymentType, setNewPaymentType] = useState<'subscription' | 'credits'>('subscription')
  const [paymentChanging, setPaymentChanging] = useState(false)
  const [activeSection, setActiveSection] = useState<SettingsSection>('personal')
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth/login')
        return
      }
      loadUserSettings()
    }
    checkAuth()
  }, [router, supabase])

  const loadUserSettings = async () => {
    try {
      // Get user metadata from Supabase Auth
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const metadata = authUser.user_metadata || {}
        
        // Get payment information and preferences from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('payment_type, subscription_status, credits, preferred_cost_code_standard')
          .eq('id', authUser.id)
          .single()
        
        if (userError) {
          console.error('Error fetching user data:', userError)
        }
        
        setSettings({
          first_name: metadata.first_name || '',
          last_name: metadata.last_name || '',
          phone: metadata.phone || '',
          email_notifications: metadata.email_notifications !== false,
          bid_notifications: metadata.bid_notifications !== false,
          marketing_emails: metadata.marketing_emails === true,
          payment_type: userData?.payment_type || 'subscription',
          subscription_status: userData?.subscription_status || 'inactive',
          credits: userData?.credits || 0,
          preferred_cost_code_standard: (userData?.preferred_cost_code_standard as CostCodeStandard) || 'csi-16'
        })
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof UserSettings, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // 1. Update user metadata in Supabase Auth (for profile info)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: settings.first_name,
          last_name: settings.last_name,
          phone: settings.phone,
          email_notifications: settings.email_notifications,
          bid_notifications: settings.bid_notifications,
          marketing_emails: settings.marketing_emails,
        }
      })

      if (authError) throw authError

      // 2. Update users table (for preferences)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { error: dbError } = await supabase
          .from('users')
          .update({
            preferred_cost_code_standard: settings.preferred_cost_code_standard
          })
          .eq('id', authUser.id)

        if (dbError) throw dbError
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handlePaymentTypeChange = (newType: 'subscription' | 'credits') => {
    setNewPaymentType(newType)
    setShowPaymentModal(true)
  }

  const confirmPaymentTypeChange = async () => {
    setPaymentChanging(true)
    setMessage(null)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('User not authenticated')

      // Update payment type in users table
      const { error } = await supabase
        .from('users')
        .update({ payment_type: newPaymentType })
        .eq('id', authUser.id)

      if (error) {
        throw error
      }

      // Update local state
      setSettings(prev => ({
        ...prev,
        payment_type: newPaymentType
      }))

      setMessage({ 
        type: 'success', 
        text: `Payment method changed to ${newPaymentType === 'credits' ? 'Credits' : 'Subscription'} successfully!` 
      })
      setShowPaymentModal(false)
    } catch (error: any) {
      console.error('Error changing payment type:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to change payment method' })
    } finally {
      setPaymentChanging(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FallingBlocksLoader text="Loading settings..." size="md" />
      </div>
    )
  }

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'personal':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Personal Information</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Update your personal details and contact information</p>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</Label>
                  <Input
                    id="first_name"
                    value={settings.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter your first name"
                    className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</Label>
                  <Input
                    id="last_name"
                    value={settings.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter your last name"
                    className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter your phone number"
                  className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                />
              </div>
            </div>
          </div>
        )

      case 'preferences':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Cost Code Standards</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select the cost code standard you prefer for your takeoffs, or upload custom cost codes</p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cost_code_standard" className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferred Standard</Label>
                <Select 
                  value={settings.preferred_cost_code_standard} 
                  onValueChange={(value) => handleInputChange('preferred_cost_code_standard', value)}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <SelectValue placeholder="Select a standard" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_STANDARDS.map((std) => (
                      <SelectItem key={std.id} value={std.id}>
                        {std.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  This standard will be used by the AI to categorize items in your future takeoffs. Select "Custom Cost Codes" if you have uploaded your own.
                </p>
              </div>

              {/* Custom Cost Codes Section */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                <CustomCostCodesManager />
              </div>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Notification Preferences</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose how you want to be notified about activity on your account</p>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex-1">
                  <Label htmlFor="email_notifications" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">Email Notifications</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Receive notifications about job requests and bids</p>
                </div>
                <Switch
                  id="email_notifications"
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) => handleInputChange('email_notifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex-1">
                  <Label htmlFor="bid_notifications" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">Bid Notifications</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get notified when you receive new bids</p>
                </div>
                <Switch
                  id="bid_notifications"
                  checked={settings.bid_notifications}
                  onCheckedChange={(checked) => handleInputChange('bid_notifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <Label htmlFor="marketing_emails" className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">Marketing Emails</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Receive updates about new features and tips</p>
                </div>
                <Switch
                  id="marketing_emails"
                  checked={settings.marketing_emails}
                  onCheckedChange={(checked) => handleInputChange('marketing_emails', checked)}
                />
              </div>
            </div>
          </div>
        )

      case 'payment':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Payment Method</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose how you want to pay for job requests</p>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {settings.payment_type === 'credits' ? (
                      <Coins className="h-5 w-5 text-orange" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {settings.payment_type === 'credits' ? 'Credits' : 'Subscription'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {settings.payment_type === 'credits' 
                          ? `You have ${settings.credits} credit${settings.credits !== 1 ? 's' : ''} available`
                          : `Status: ${settings.subscription_status}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Switch Payment Method:</Label>
                <div className="flex space-x-3">
                  <Button
                    variant={settings.payment_type === 'subscription' ? 'orange' : 'construction'}
                    size="sm"
                    onClick={() => handlePaymentTypeChange('subscription')}
                    disabled={settings.payment_type === 'subscription'}
                    className="flex items-center space-x-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Subscription</span>
                  </Button>
                  <Button
                    variant={settings.payment_type === 'credits' ? 'orange' : 'construction'}
                    size="sm"
                    onClick={() => handlePaymentTypeChange('credits')}
                    disabled={settings.payment_type === 'credits'}
                    className="flex items-center space-x-2"
                  >
                    <Coins className="h-4 w-4" />
                    <span>Credits</span>
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p><strong className="text-gray-900 dark:text-gray-100">Subscription:</strong> Monthly recurring payment for unlimited job requests</p>
                <p><strong className="text-gray-900 dark:text-gray-100">Credits:</strong> Pay per job request ($20 per credit, never expire)</p>
              </div>
            </div>
          </div>
        )

      case 'documents':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Document Templates</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your document templates</p>
            </div>
            <DocumentTemplatesManager />
          </div>
        )

      case 'emails':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Email Templates</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your email templates</p>
            </div>
            <EmailTemplatesManager />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account</p>
        </div>
        
        <nav className="px-3 pb-6">
          <div className="space-y-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4" />}
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg border ${
              message.type === 'success' 
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
                : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          {/* Section Content */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8">
            {renderSectionContent()}
          </div>

          {/* Save Button - Only show for sections that need saving */}
          {(activeSection === 'personal' || activeSection === 'preferences' || activeSection === 'notifications') && (
            <div className="flex justify-end mt-6">
              <Button onClick={handleSave} variant="orange" disabled={saving} className="min-w-32 font-semibold">
                {saving ? (
                  <div className="flex items-center justify-center">
                    <FallingBlocksLoader text="" size="sm" />
                    <span className="ml-2">Saving...</span>
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method Change Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center">
                {newPaymentType === 'credits' ? (
                  <Coins className="h-5 w-5 mr-2 text-orange" />
                ) : (
                  <CreditCard className="h-5 w-5 mr-2 text-gray-700 dark:text-gray-300" />
                )}
                Switch to {newPaymentType === 'credits' ? 'Credits' : 'Subscription'}
              </CardTitle>
              <CardDescription>
                Are you sure you want to change your payment method?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  <strong>Important:</strong> Changing your payment method will affect how you pay for future job requests.
                  {newPaymentType === 'credits' && ' You will need to purchase credits before posting jobs.'}
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="construction"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPaymentTypeChange}
                  variant="orange"
                  disabled={paymentChanging}
                  className="flex-1 font-semibold"
                >
                  {paymentChanging ? (
                    <div className="flex items-center justify-center">
                      <FallingBlocksLoader text="" size="sm" />
                      <span className="ml-2">Changing...</span>
                    </div>
                  ) : (
                    'Confirm Change'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
