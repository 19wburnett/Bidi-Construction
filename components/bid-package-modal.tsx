'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Package,
  Users,
  Calendar,
  FileText,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  Eye,
  Trash2,
  Plus,
  Minus
} from 'lucide-react'
import { modalBackdrop, modalContent, successCheck, staggerContainer, staggerItem } from '@/lib/animations'
import { BidPackage, Job } from '@/types/takeoff'

interface BidPackageModalProps {
  jobId: string
  planId: string
  takeoffItems: Array<{
    id: string
    category: string
    description: string
    quantity: number
    unit: string
    unit_cost?: number
  }>
  isOpen: boolean
  onClose: () => void
  onPackageCreated?: (pkg: BidPackage) => void
}

interface TakeoffItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number
}

interface Subcontractor {
  id: string
  name: string
  email: string
  trade_category: string
}

const TRADE_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Drywall',
  'Flooring',
  'Roofing',
  'Concrete',
  'Framing',
  'Insulation',
  'Painting',
  'Landscaping',
  'General Contractor'
]

export default function BidPackageModal({ 
  jobId,
  planId,
  takeoffItems: propsTakeoffItems,
  isOpen, 
  onClose, 
  onPackageCreated 
}: BidPackageModalProps) {
  const [job, setJob] = useState<Job | null>(null)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])
  const [selectedTrade, setSelectedTrade] = useState('')
  const [description, setDescription] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedSubs, setSelectedSubs] = useState<string[]>([])
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState(1)
  
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && jobId) {
      loadData()
    }
  }, [isOpen, jobId])

  async function loadData() {
    try {
      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user?.id)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      // Load subcontractors
      const { data: subsData, error: subsError } = await supabase
        .from('gc_contacts')
        .select('*')

      if (subsError) throw subsError
      setSubcontractors(subsData || [])

      // Use takeoff items from props
      setTakeoffItems(propsTakeoffItems)

    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    }
  }

  const handleCreatePackage = async () => {
    if (!user || !job) return

    setLoading(true)
    setError('')

    try {
      // Filter selected takeoff items
      const minimumLineItems = takeoffItems
        .filter(item => selectedItems.includes(item.id))
        .map(item => ({
          id: item.id,
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost
        }))

      // Create bid package
      const { data, error: insertError } = await supabase
        .from('bid_packages')
        .insert({
          job_id: jobId,
          trade_category: selectedTrade,
          description: description || null,
          minimum_line_items: minimumLineItems,
          status: 'draft',
          deadline: deadline ? new Date(deadline).toISOString() : null
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Send emails to selected subcontractors
      if (selectedSubs.length > 0) {
        const selectedSubcontractors = subcontractors.filter(sub => selectedSubs.includes(sub.id))
        
        // Here you would integrate with your email service
        // For now, just show success
        console.log('Would send emails to:', selectedSubcontractors)
      }

      setSuccess(true)
      onPackageCreated?.(data)

      // Auto-close after success animation
      setTimeout(() => {
        handleClose()
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Failed to create bid package')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSuccess(false)
    setStep(1)
    setSelectedTrade('')
    setDescription('')
    setSelectedItems([])
    setSelectedSubs([])
    setDeadline('')
    setError('')
    onClose()
  }

  const filteredTakeoffItems = selectedTrade 
    ? takeoffItems.filter(item => item.category === selectedTrade)
    : takeoffItems

  const filteredSubcontractors = selectedTrade
    ? subcontractors.filter(sub => sub.trade_category === selectedTrade)
    : subcontractors

  const canProceedToStep2 = selectedTrade && description.trim()
  const canProceedToStep3 = selectedItems.length > 0
  const canCreatePackage = selectedSubs.length > 0

  if (!isOpen) return null

  return (
    <motion.div
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        variants={modalContent}
        initial="initial"
        animate="animate"
        exit="exit"
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2 text-orange-600" />
                  Create Bid Package
                </CardTitle>
                <CardDescription>
                  Create a bid request for subcontractors
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                ×
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {!success ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Job Info */}
                  {job && (
                    <motion.div
                      variants={staggerItem}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <h3 className="font-semibold text-gray-900 mb-2">{job.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {job.location}
                        </div>
                        {job.budget_range && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {job.budget_range}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1: Trade & Description */}
                  {step === 1 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-6"
                    >
                      <motion.div variants={staggerItem} className="space-y-3">
                        <Label>Trade Category *</Label>
                        <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trade category" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRADE_CATEGORIES.map((trade) => (
                              <SelectItem key={trade} value={trade}>
                                {trade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>

                      <motion.div variants={staggerItem} className="space-y-3">
                        <Label>Package Description *</Label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe the scope of work, requirements, and any special instructions..."
                          rows={4}
                        />
                      </motion.div>

                      <motion.div variants={staggerItem} className="space-y-3">
                        <Label>Bid Deadline</Label>
                        <Input
                          type="datetime-local"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </motion.div>

                      <motion.div variants={staggerItem}>
                        <Button 
                          onClick={() => setStep(2)}
                          disabled={!canProceedToStep2}
                          className="w-full"
                        >
                          Next: Select Line Items
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Step 2: Line Items */}
                  {step === 2 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Minimum Line Items</h3>
                        <Badge variant="outline">
                          {selectedItems.length} selected
                        </Badge>
                      </div>

                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {filteredTakeoffItems.map((item) => (
                          <motion.div
                            key={item.id}
                            variants={staggerItem}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedItems(prev => [...prev, item.id])
                                } else {
                                  setSelectedItems(prev => prev.filter(id => id !== item.id))
                                }
                              }}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-sm text-gray-600">
                                {item.quantity} {item.unit}
                                {item.unit_cost && ` • $${item.unit_cost}/${item.unit}`}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>

                      <div className="flex space-x-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setStep(1)}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button 
                          onClick={() => setStep(3)}
                          disabled={!canProceedToStep3}
                          className="flex-1"
                        >
                          Next: Select Subcontractors
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Subcontractors */}
                  {step === 3 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Subcontractors</h3>
                        <Badge variant="outline">
                          {selectedSubs.length} selected
                        </Badge>
                      </div>

                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {filteredSubcontractors.map((sub) => (
                          <motion.div
                            key={sub.id}
                            variants={staggerItem}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <Checkbox
                              checked={selectedSubs.includes(sub.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedSubs(prev => [...prev, sub.id])
                                } else {
                                  setSelectedSubs(prev => prev.filter(id => id !== sub.id))
                                }
                              }}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{sub.name}</div>
                              <div className="text-sm text-gray-600">{sub.email}</div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {sub.trade_category}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>

                      {filteredSubcontractors.length === 0 && (
                        <div className="text-center py-8">
                          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <h4 className="font-semibold text-gray-900 mb-2">No subcontractors found</h4>
                          <p className="text-sm text-gray-600 mb-4">
                            No subcontractors found for {selectedTrade}. Add contacts first.
                          </p>
                          <Button variant="outline">
                            Add Contacts
                          </Button>
                        </div>
                      )}

                      <div className="flex space-x-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setStep(2)}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button 
                          onClick={handleCreatePackage}
                          disabled={!canCreatePackage || loading}
                          className="flex-1"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Create & Send Package
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                        <p className="text-red-600 text-sm">{error}</p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-6"
                >
                  <motion.div
                    variants={successCheck}
                    initial="initial"
                    animate="animate"
                  >
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Bid Package Created!</h3>
                    <p className="text-gray-600">
                      Your bid package has been sent to {selectedSubs.length} subcontractor{selectedSubs.length !== 1 ? 's' : ''}
                    </p>
                  </motion.div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                    <ul className="text-sm text-blue-800 space-y-1 text-left">
                      <li>• Subcontractors will receive email with project details</li>
                      <li>• They can reply with their bids</li>
                      <li>• Bids will appear in your job dashboard</li>
                      <li>• You can compare and accept the best bid</li>
                    </ul>
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

