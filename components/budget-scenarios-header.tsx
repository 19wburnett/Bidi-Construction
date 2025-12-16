'use client'

import React, { useState } from 'react'
import { Plus, BarChart3, CheckCircle2, Edit2, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Scenario {
  id: string
  name: string
  description: string | null
  is_active: boolean
  bids: any[]
}

interface BudgetScenariosHeaderProps {
  scenarios: Scenario[]
  activeScenarioId: string | null
  onScenarioChange: (scenarioId: string | null) => void
  onCreateScenario: (name: string, description?: string) => Promise<void>
  onApplyScenario: (scenarioId: string) => Promise<void>
  onCompareScenarios: () => void
  onEditScenario?: (scenarioId: string) => void
  onDeleteScenario?: (scenarioId: string) => Promise<void>
  totalBudget?: number
  coveragePercentage?: number
  gapCount?: number
  bidCount?: number
  isLoading?: boolean
}

export default function BudgetScenariosHeader({
  scenarios,
  activeScenarioId,
  onScenarioChange,
  onCreateScenario,
  onApplyScenario,
  onCompareScenarios,
  onEditScenario,
  onDeleteScenario,
  totalBudget = 0,
  coveragePercentage = 0,
  gapCount = 0,
  bidCount = 0,
  isLoading = false
}: BudgetScenariosHeaderProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [scenarioToDelete, setScenarioToDelete] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [newScenarioDescription, setNewScenarioDescription] = useState('')

  const activeScenario = scenarios.find(s => s.id === activeScenarioId)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const handleCreateScenario = async () => {
    if (!newScenarioName.trim()) {
      return
    }

    setCreating(true)
    try {
      await onCreateScenario(newScenarioName.trim(), newScenarioDescription.trim() || undefined)
      setNewScenarioName('')
      setNewScenarioDescription('')
      setShowCreateDialog(false)
    } catch (error) {
      console.error('Error creating scenario:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleApplyScenario = async () => {
    if (!activeScenarioId) return

    setApplying(true)
    try {
      await onApplyScenario(activeScenarioId)
    } catch (error) {
      console.error('Error applying scenario:', error)
    } finally {
      setApplying(false)
    }
  }

  const handleDeleteScenario = async () => {
    if (!scenarioToDelete || !onDeleteScenario) return

    setDeleting(true)
    try {
      await onDeleteScenario(scenarioToDelete)
      if (scenarioToDelete === activeScenarioId) {
        onScenarioChange(null)
      }
      setShowDeleteDialog(false)
      setScenarioToDelete(null)
    } catch (error) {
      console.error('Error deleting scenario:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-gradient-to-r from-orange-50 to-orange-50/50 border border-orange-200 rounded-lg p-4 space-y-4">
        {/* Scenario Selector and Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <Select
              value={activeScenarioId || 'none'}
              onValueChange={(value) => {
                if (value === 'none') {
                  onScenarioChange(null)
                } else {
                  onScenarioChange(value)
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Scenario (Accepted Bids)</SelectItem>
                {scenarios.map(scenario => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                    {scenario.is_active && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Active
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeScenario && (
              <div className="flex items-center gap-2">
                {activeScenario.is_active && (
                  <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
                {onEditScenario && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditScenario(activeScenario.id)}
                    className="h-8"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
                {onDeleteScenario && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setScenarioToDelete(activeScenario.id)
                      setShowDeleteDialog(true)
                    }}
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Scenario
            </Button>
            {scenarios.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCompareScenarios}
                disabled={isLoading}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Compare
              </Button>
            )}
            {activeScenarioId && (
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyScenario}
                disabled={isLoading || applying || activeScenario?.is_active}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Apply Scenario
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-900">
              {formatCurrency(totalBudget)}
            </div>
            <div className="text-xs text-orange-600">Total Budget</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">
              {coveragePercentage}%
            </div>
            <div className="text-xs text-blue-600">Coverage</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-900">
              {gapCount}
            </div>
            <div className="text-xs text-red-600">Gaps</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {bidCount}
            </div>
            <div className="text-xs text-gray-600">Bids in Scenario</div>
          </div>
        </div>
      </div>

      {/* Create Scenario Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Budget Scenario</DialogTitle>
            <DialogDescription>
              Create a new budget scenario to compare different bid combinations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Scenario Name</Label>
              <Input
                id="scenario-name"
                placeholder="e.g., Budget A: All Low Bids"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newScenarioName.trim()) {
                    handleCreateScenario()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-description">Description (Optional)</Label>
              <Textarea
                id="scenario-description"
                placeholder="Describe this budget scenario..."
                value={newScenarioDescription}
                onChange={(e) => setNewScenarioDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setNewScenarioName('')
                setNewScenarioDescription('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateScenario}
              disabled={!newScenarioName.trim() || creating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Scenario Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scenario</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this scenario? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setScenarioToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteScenario}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

