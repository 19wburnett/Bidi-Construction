'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Settings, Mail, Clock, Save, X, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AutomationSettings {
  no_response_enabled: boolean
  no_response_days: number[]
  deadline_reminder_enabled: boolean
  deadline_reminder_days: number[]
}

interface BidPackageAutomationSettingsProps {
  bidPackageId: string
  deadline?: string | Date | null
  onSave?: () => void
}

export default function BidPackageAutomationSettings({
  bidPackageId,
  deadline,
  onSave
}: BidPackageAutomationSettingsProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasCustomSettings, setHasCustomSettings] = useState(false)
  const [settings, setSettings] = useState<AutomationSettings>({
    no_response_enabled: true,
    no_response_days: [3, 7, 14],
    deadline_reminder_enabled: true,
    deadline_reminder_days: [7, 3, 1]
  })
  const [globalDefaults, setGlobalDefaults] = useState<AutomationSettings>({
    no_response_enabled: true,
    no_response_days: [3, 7, 14],
    deadline_reminder_enabled: true,
    deadline_reminder_days: [7, 3, 1]
  })
  const [noResponseDaysInput, setNoResponseDaysInput] = useState('')
  const [deadlineReminderDaysInput, setDeadlineReminderDaysInput] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [bidPackageId])

  useEffect(() => {
    // Update input fields when settings change
    setNoResponseDaysInput(settings.no_response_days.join(', '))
    setDeadlineReminderDaysInput(settings.deadline_reminder_days.join(', '))
  }, [settings])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/bid-packages/${bidPackageId}/automations`)
      
      if (!response.ok) {
        throw new Error('Failed to load automation settings')
      }

      const data = await response.json()
      setSettings(data.settings)
      setHasCustomSettings(data.hasCustomSettings)
      setGlobalDefaults(data.globalDefaults)
      
      // Initialize input fields
      setNoResponseDaysInput(data.settings.no_response_days.join(', '))
      setDeadlineReminderDaysInput(data.settings.deadline_reminder_days.join(', '))
    } catch (error: any) {
      console.error('Error loading settings:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const parseDaysInput = (input: string): number[] => {
    return input
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => b - a) // Sort descending for deadline reminders, ascending for no-response
  }

  const handleNoResponseDaysChange = (value: string) => {
    setNoResponseDaysInput(value)
    const days = parseDaysInput(value)
    if (days.length > 0) {
      setSettings(prev => ({ ...prev, no_response_days: days.sort((a, b) => a - b) }))
    }
  }

  const handleDeadlineReminderDaysChange = (value: string) => {
    setDeadlineReminderDaysInput(value)
    const days = parseDaysInput(value)
    if (days.length > 0) {
      setSettings(prev => ({ ...prev, deadline_reminder_days: days.sort((a, b) => b - a) }))
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      // Parse and validate days
      const noResponseDays = parseDaysInput(noResponseDaysInput)
      const deadlineReminderDays = parseDaysInput(deadlineReminderDaysInput)

      if (noResponseDays.length === 0 && settings.no_response_enabled) {
        throw new Error('Please enter at least one day for no-response reminders')
      }

      if (deadlineReminderDays.length === 0 && settings.deadline_reminder_enabled) {
        throw new Error('Please enter at least one day for deadline reminders')
      }

      const updateData: Partial<AutomationSettings> = {
        no_response_enabled: settings.no_response_enabled,
        deadline_reminder_enabled: settings.deadline_reminder_enabled
      }

      if (noResponseDays.length > 0) {
        updateData.no_response_days = noResponseDays
      }

      if (deadlineReminderDays.length > 0) {
        updateData.deadline_reminder_days = deadlineReminderDays
      }

      const response = await fetch(`/api/bid-packages/${bidPackageId}/automations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setHasCustomSettings(true)
      setMessage({ type: 'success', text: 'Settings saved successfully' })
      
      if (onSave) {
        onSave()
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleUseDefaults = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`/api/bid-packages/${bidPackageId}/automations`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to reset to defaults')
      }

      setHasCustomSettings(false)
      setSettings(globalDefaults)
      setNoResponseDaysInput(globalDefaults.no_response_days.join(', '))
      setDeadlineReminderDaysInput(globalDefaults.deadline_reminder_days.join(', '))
      setMessage({ type: 'success', text: 'Reset to global defaults' })
      
      if (onSave) {
        onSave()
      }

      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error resetting to defaults:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to reset to defaults' })
    } finally {
      setSaving(false)
    }
  }

  const formatDeadlinePreview = () => {
    if (!deadline) return null
    
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntil < 0) return 'Deadline has passed'
    
    return `Deadline: ${deadlineDate.toLocaleDateString()} (${daysUntil} days away)`
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {hasCustomSettings && (
        <div className="flex justify-end">
          <Badge variant="secondary">
            Custom Settings
          </Badge>
        </div>
      )}

      {/* No-Response Follow-ups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                No-Response Follow-ups
              </CardTitle>
              <CardDescription className="mt-1">
                Send reminders if subcontractors don't respond after a certain number of days
              </CardDescription>
            </div>
            <Switch
              checked={settings.no_response_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, no_response_enabled: checked }))
              }
            />
          </div>
        </CardHeader>
        {settings.no_response_enabled && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="no-response-days">Days after send to remind (comma-separated)</Label>
              <Input
                id="no-response-days"
                value={noResponseDaysInput}
                onChange={(e) => handleNoResponseDaysChange(e.target.value)}
                placeholder="3, 7, 14"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 3, 7, 14 means reminders will be sent 3, 7, and 14 days after the initial email
              </p>
            </div>
            {settings.no_response_days.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.no_response_days.map((day, idx) => (
                  <Badge key={idx} variant="outline">
                    Day {day}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Deadline Reminders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Deadline Reminders
              </CardTitle>
              <CardDescription className="mt-1">
                Send reminders X days before the bid deadline
              </CardDescription>
            </div>
            <Switch
              checked={settings.deadline_reminder_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, deadline_reminder_enabled: checked }))
              }
            />
          </div>
        </CardHeader>
        {settings.deadline_reminder_enabled && (
          <CardContent className="space-y-4">
            {deadline && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{formatDeadlinePreview()}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="deadline-reminder-days">Days before deadline to remind (comma-separated)</Label>
              <Input
                id="deadline-reminder-days"
                value={deadlineReminderDaysInput}
                onChange={(e) => handleDeadlineReminderDaysChange(e.target.value)}
                placeholder="7, 3, 1"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 7, 3, 1 means reminders will be sent 7, 3, and 1 day before the deadline
              </p>
            </div>
            {settings.deadline_reminder_days.length > 0 && deadline && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Reminder Schedule:</p>
                <div className="flex flex-wrap gap-2">
                  {settings.deadline_reminder_days.map((day, idx) => {
                    const deadlineDate = new Date(deadline)
                    deadlineDate.setDate(deadlineDate.getDate() - day)
                    return (
                      <Badge key={idx} variant="outline">
                        {day} day{day !== 1 ? 's' : ''} before ({deadlineDate.toLocaleDateString()})
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleUseDefaults}
          disabled={saving || !hasCustomSettings}
        >
          <X className="h-4 w-4 mr-2" />
          Use Global Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
