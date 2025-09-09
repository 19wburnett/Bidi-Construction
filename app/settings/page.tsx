'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase'
import { Building2, ArrowLeft, Save, User, Phone, Bell, CreditCard, Coins } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'

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
}

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
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [newPaymentType, setNewPaymentType] = useState<'subscription' | 'credits'>('subscription')
  const [paymentChanging, setPaymentChanging] = useState(false)
  
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
        
        // Get payment information from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('payment_type, subscription_status, credits')
          .eq('id', authUser.id)
          .single()
        
        if (userError) {
          console.error('Error fetching user payment data:', userError)
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
      // Update user metadata in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: settings.first_name,
          last_name: settings.last_name,
          phone: settings.phone,
          email_notifications: settings.email_notifications,
          bid_notifications: settings.bid_notifications,
          marketing_emails: settings.marketing_emails,
        }
      })

      if (error) {
        throw error
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bidi</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
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

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600">Manage your account preferences and notifications</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={settings.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={settings.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center">
                  <Phone className="h-4 w-4 mr-1" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to be notified about activity on your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email_notifications">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications about job requests and bids</p>
                </div>
                <Switch
                  id="email_notifications"
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) => handleInputChange('email_notifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="bid_notifications">Bid Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when you receive new bids</p>
                </div>
                <Switch
                  id="bid_notifications"
                  checked={settings.bid_notifications}
                  onCheckedChange={(checked) => handleInputChange('bid_notifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="marketing_emails">Marketing Emails</Label>
                  <p className="text-sm text-gray-500">Receive updates about new features and tips</p>
                </div>
                <Switch
                  id="marketing_emails"
                  checked={settings.marketing_emails}
                  onCheckedChange={(checked) => handleInputChange('marketing_emails', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Payment Method
              </CardTitle>
              <CardDescription>
                Choose how you want to pay for job requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {/* Current Payment Method Display */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {settings.payment_type === 'credits' ? (
                        <Coins className="h-5 w-5 text-orange-600" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {settings.payment_type === 'credits' ? 'Credits' : 'Subscription'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {settings.payment_type === 'credits' 
                            ? `You have ${settings.credits} credit${settings.credits !== 1 ? 's' : ''} available`
                            : `Status: ${settings.subscription_status}`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method Options */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Switch Payment Method:</Label>
                  <div className="flex space-x-3">
                    <Button
                      variant={settings.payment_type === 'subscription' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePaymentTypeChange('subscription')}
                      disabled={settings.payment_type === 'subscription'}
                      className="flex items-center space-x-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Subscription</span>
                    </Button>
                    <Button
                      variant={settings.payment_type === 'credits' ? 'default' : 'outline'}
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

                {/* Payment Method Info */}
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Subscription:</strong> Monthly recurring payment for unlimited job requests</p>
                  <p><strong>Credits:</strong> Pay per job request ($20 per credit, never expire)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="min-w-32">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Method Change Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                {newPaymentType === 'credits' ? (
                  <Coins className="h-5 w-5 mr-2 text-orange-600" />
                ) : (
                  <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                )}
                Switch to {newPaymentType === 'credits' ? 'Credits' : 'Subscription'}
              </CardTitle>
              <CardDescription>
                Are you sure you want to change your payment method?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-700">
                  <strong>Important:</strong> Changing your payment method will affect how you pay for future job requests.
                  {newPaymentType === 'credits' && ' You will need to purchase credits before posting jobs.'}
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPaymentTypeChange}
                  disabled={paymentChanging}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {paymentChanging ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Changing...
                    </>
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
