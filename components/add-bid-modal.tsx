import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase'
import { Plus, User, FileText, DollarSign, Calendar, MapPin, Mail, Briefcase, Check, ChevronsUpDown, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddBidModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
  onBidAdded: () => void
}

interface Subcontractor {
  id: string
  name: string
  email: string
  trade_category: string
}

interface BidPackage {
  id: string
  trade_category: string
  description: string | null
}

interface LineItem {
  id: string
  description: string
  quantity: string
  unit: string
  unit_price: string
  amount: number
}

export default function AddBidModal({ jobId, isOpen, onClose, onBidAdded }: AddBidModalProps) {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form State
  const [selectedSubId, setSelectedSubId] = useState<string>('')
  const [isSubComboboxOpen, setIsSubComboboxOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('none')
  const [timeline, setTimeline] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  
  // New Subcontractor State
  const [newSubName, setNewSubName] = useState('')
  const [newSubEmail, setNewSubEmail] = useState('')
  const [newSubTrade, setNewSubTrade] = useState('')
  const [newSubLocation, setNewSubLocation] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadData()
      // Initialize with one empty line item
      setLineItems([{ id: crypto.randomUUID(), description: '', quantity: '', unit: '', unit_price: '', amount: 0 }])
    }
  }, [isOpen, jobId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: subsData } = await supabase
        .from('subcontractors')
        .select('id, name, email, trade_category')
        .order('name')

      setSubcontractors(subsData || [])

      const { data: packagesData } = await supabase
        .from('bid_packages')
        .select('id, trade_category, description')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      setBidPackages(packagesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Line Item Handlers
  const addLineItem = () => {
    setLineItems([...lineItems, { id: crypto.randomUUID(), description: '', quantity: '', unit: '', unit_price: '', amount: 0 }])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        
        // Recalculate amount if quantity or unit_price changes
        if (field === 'quantity' || field === 'unit_price') {
          const quantity = parseFloat(updatedItem.quantity) || 0
          const unitPrice = parseFloat(updatedItem.unit_price) || 0
          updatedItem.amount = quantity * unitPrice
        }
        return updatedItem
      }
      return item
    }))
  }

  const totalBidAmount = lineItems.reduce((sum, item) => sum + item.amount, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      let subcontractorId = selectedSubId

      // Create new subcontractor if needed
      if (selectedSubId === 'new') {
        const { data: newSub, error: subError } = await supabase
          .from('subcontractors')
          .insert({
            name: newSubName,
            email: newSubEmail,
            trade_category: newSubTrade,
            location: newSubLocation
          })
          .select()
          .single()

        if (subError) throw subError
        subcontractorId = newSub.id
      } else if (!selectedSubId) {
        alert('Please select a subcontractor')
        setSubmitting(false)
        return
      }

      // Create bid
      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .insert({
          job_id: jobId,
          subcontractor_id: subcontractorId,
          bid_package_id: selectedPackageId === 'none' ? null : selectedPackageId,
          bid_amount: null, // Calculated from line items
          timeline: timeline || null,
          notes: notes || null,
          status: 'pending',
          raw_email: selectedSubId === 'new' ? newSubEmail : subcontractors.find(s => s.id === selectedSubId)?.email || '',
        })
        .select()
        .single()

      if (bidError) throw bidError

      // Insert line items
      if (bidData && lineItems.length > 0) {
        const lineItemsToInsert = lineItems
          .filter(item => item.description.trim() !== '') // Only insert items with descriptions
          .map((item, index) => ({
            bid_id: bidData.id,
            item_number: index + 1,
            description: item.description,
            quantity: parseFloat(item.quantity) || null,
            unit: item.unit || null,
            unit_price: parseFloat(item.unit_price) || null,
            amount: item.amount
          }))

        if (lineItemsToInsert.length > 0) {
          const { error: lineItemsError } = await supabase
            .from('bid_line_items')
            .insert(lineItemsToInsert)

          if (lineItemsError) throw lineItemsError
        }
      }

      onBidAdded()
      handleClose()
    } catch (error) {
      console.error('Error creating bid:', error)
      alert('Failed to create bid. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setSelectedSubId('')
    setIsSubComboboxOpen(false)
    setSelectedPackageId('none')
    setTimeline('')
    setNotes('')
    setNewSubName('')
    setNewSubEmail('')
    setNewSubTrade('')
    setNewSubLocation('')
    setLineItems([])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:p-6">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl">Manually Add Bid</DialogTitle>
          <DialogDescription className="mt-1.5 text-base">
            Record a bid received outside the platform or from a new subcontractor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 py-6">
          {/* Subcontractor Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 rounded-full">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Subcontractor</h3>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Subcontractor</Label>
                <Popover open={isSubComboboxOpen} onOpenChange={setIsSubComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSubComboboxOpen}
                      className="w-full justify-between bg-white"
                    >
                      {selectedSubId === 'new' 
                        ? "Create New Subcontractor"
                        : selectedSubId
                          ? subcontractors.find((sub) => sub.id === selectedSubId)?.name
                          : "Select subcontractor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 z-[10001]" align="start">
                    <Command>
                      <CommandInput placeholder="Search subcontractors..." />
                      <CommandList>
                        <CommandEmpty>No subcontractor found.</CommandEmpty>
                        <CommandGroup heading="Actions">
                          <CommandItem
                            onSelect={() => {
                              setSelectedSubId('new')
                              setIsSubComboboxOpen(false)
                            }}
                            className="text-orange-600 font-medium cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Subcontractor
                          </CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Existing Subcontractors">
                          {subcontractors.map((sub) => (
                            <CommandItem
                              key={sub.id}
                              value={sub.name}
                              onSelect={() => {
                                setSelectedSubId(sub.id)
                                setIsSubComboboxOpen(false)
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedSubId === sub.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{sub.name}</span>
                                <span className="text-xs text-gray-500">{sub.trade_category} • {sub.email}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedSubId === 'new' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label htmlFor="sub-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Name</Label>
                    <div className="relative">
                      <Input 
                        id="sub-name" 
                        value={newSubName} 
                        onChange={(e) => setNewSubName(e.target.value)}
                        required 
                        className="pl-9 bg-white"
                        placeholder="e.g. Acme Construction"
                      />
                      <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</Label>
                    <div className="relative">
                      <Input 
                        id="sub-email" 
                        type="email" 
                        value={newSubEmail} 
                        onChange={(e) => setNewSubEmail(e.target.value)}
                        required 
                        className="pl-9 bg-white"
                        placeholder="contact@example.com"
                      />
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub-trade" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trade Category</Label>
                    <div className="relative">
                      <Input 
                        id="sub-trade" 
                        value={newSubTrade} 
                        onChange={(e) => setNewSubTrade(e.target.value)}
                        required 
                        className="pl-9 bg-white"
                        placeholder="e.g. Electrical"
                      />
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub-location" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</Label>
                    <div className="relative">
                      <Input 
                        id="sub-location" 
                        value={newSubLocation} 
                        onChange={(e) => setNewSubLocation(e.target.value)}
                        required 
                        className="pl-9 bg-white"
                        placeholder="City, State"
                      />
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bid Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-100 rounded-full">
                <FileText className="h-4 w-4 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Bid Details</h3>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Bid Package (Optional)</Label>
                <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Specific Package</SelectItem>
                    {bidPackages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.trade_category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bid-amount" className="text-sm font-medium">Total Bid Amount</Label>
                <div className="relative">
                  <Input 
                    id="bid-amount" 
                    type="text" 
                    value={`$${totalBidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    readOnly
                    className="pl-9 bg-gray-50 font-semibold text-green-700"
                  />
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-green-600" />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200 max-h-[300px] overflow-y-auto">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-1 pt-2.5 text-center text-sm text-gray-500">#{index + 1}</div>
                      <div className="col-span-4">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          placeholder="Unit"
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Price"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(item.id, 'unit_price', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-1 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="col-span-12 text-right text-xs text-gray-500 pr-10">
                        Amount: ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="timeline" className="text-sm font-medium">Timeline / Duration</Label>
                <div className="relative">
                  <Input 
                    id="timeline" 
                    value={timeline} 
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. 2 weeks, starting June 1st"
                    className="pl-9 bg-white"
                  />
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes" className="text-sm font-medium">Notes & Exclusions</Label>
                <Textarea 
                  id="notes" 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional details, inclusions, or exclusions..."
                  rows={4}
                  className="bg-white resize-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-[120px]">
              {submitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Add Bid'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
