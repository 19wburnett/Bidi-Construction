'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Users, FileText, Mail, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'
import { BidPackage } from '@/types/takeoff'
import { createClient } from '@/lib/supabase'

interface BidPackageViewModalProps {
  bidPackageId: string | null
  isOpen: boolean
  onClose: () => void
}

interface Recipient {
  id: string
  subcontractor_email: string
  subcontractor_name: string | null
  status: string
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  responded_at: string | null
  bid_id: string | null
  subcontractors?: {
    id: string
    name: string
    email: string
    phone: string | null
  } | null
  bids?: Array<{
    id: string
    bid_amount: number | null
    timeline: string | null
    status: string | null
  }>
}

export default function BidPackageViewModal({ bidPackageId, isOpen, onClose }: BidPackageViewModalProps) {
  const [bidPackage, setBidPackage] = useState<BidPackage | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && bidPackageId) {
      loadPackageData()
      loadRecipients()
    }
  }, [isOpen, bidPackageId])

  async function loadPackageData() {
    if (!bidPackageId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('id', bidPackageId)
        .single()
      
      if (!error && data) {
        setBidPackage(data)
      }
    } catch (error) {
      console.error('Error loading package data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRecipients() {
    if (!bidPackageId) return
    
    try {
      const response = await fetch(`/api/bid-packages/${bidPackageId}/recipients`)
      if (response.ok) {
        const data = await response.json()
        setRecipients(data.recipients || [])
      }
    } catch (error) {
      console.error('Error loading recipients:', error)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    opened: 'bg-green-100 text-green-800',
    responded: 'bg-purple-100 text-purple-800',
    bounced: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800'
  }

  const statusIcons: Record<string, any> = {
    sent: Mail,
    delivered: CheckCircle,
    opened: CheckCircle,
    responded: CheckCircle,
    bounced: XCircle,
    failed: XCircle,
    pending: Clock
  }

  // Handle minimum_line_items which might be a JSON string or array
  let lineItems: any[] = []
  if (bidPackage?.minimum_line_items) {
    if (typeof bidPackage.minimum_line_items === 'string') {
      try {
        const parsed = JSON.parse(bidPackage.minimum_line_items)
        lineItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.takeoffs || [])
      } catch {
        lineItems = []
      }
    } else if (Array.isArray(bidPackage.minimum_line_items)) {
      lineItems = bidPackage.minimum_line_items
    }
  }

  const recipientsWithBids = recipients.filter(r => r.bid_id || (r.bids && r.bids.length > 0))
  const recipientsWithoutBids = recipients.filter(r => !r.bid_id && (!r.bids || r.bids.length === 0))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="relative w-[60vw] max-w-none max-h-[90vh] overflow-y-auto p-8">
        <DialogClose onClick={onClose} />
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center text-2xl">
            <Package className="h-6 w-6 mr-3 text-orange-600" />
            Bid Package Details
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            View package contents and recipient information
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto"></div>
            <p className="text-gray-500 mt-3 text-lg">Loading package details...</p>
          </div>
        ) : bidPackage ? (
          <div className="space-y-6 pt-2">
            {/* Top Section: Package Info and Contents Side by Side */}
            <div className="grid grid-cols-2 gap-6">
              {/* Package Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Package Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Trade Category</label>
                      <Badge variant="outline" className="text-base px-4 py-2">
                        {bidPackage.trade_category}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                      <Badge className={`text-base px-4 py-2 ${bidPackage.status === 'sent' ? 'bg-green-100 text-green-800' : 
                                      bidPackage.status === 'closed' ? 'bg-gray-100 text-gray-800' : 
                                      'bg-blue-100 text-blue-800'}`}>
                        {bidPackage.status}
                      </Badge>
                    </div>
                  </div>

                  {bidPackage.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
                      <p className="text-gray-900 leading-relaxed">{bidPackage.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 pt-2 border-t">
                    {bidPackage.sent_at && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Sent At</label>
                        <p className="text-gray-900">
                          {new Date(bidPackage.sent_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {bidPackage.deadline && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Deadline</label>
                        <p className="text-gray-900">
                          {new Date(bidPackage.deadline).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Package Contents */}
              {lineItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Package Contents ({lineItems.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-gray-50">
                      <div className="space-y-2">
                        {lineItems.map((item: any, index: number) => (
                          <div key={index} className="bg-white p-3 rounded border hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {item.description || item.name || item.item_name || `Item ${index + 1}`}
                                </div>
                                {item.category && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    {item.category}
                                  </div>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                {item.quantity !== undefined && (
                                  <div className="text-base font-semibold text-gray-900 whitespace-nowrap">
                                    {item.quantity} {item.unit || ''}
                                  </div>
                                )}
                                {item.unit_cost !== undefined && item.unit_cost !== null && (
                                  <div className="text-sm text-gray-500 whitespace-nowrap">
                                    ${Number(item.unit_cost).toLocaleString()}/{item.unit || 'unit'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recipients */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Recipients ({recipients.length} total)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recipients with Bids */}
                {recipientsWithBids.length > 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-700 mb-4 flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                      Received Bids ({recipientsWithBids.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {recipientsWithBids.map((recipient) => {
                        const StatusIcon = statusIcons[recipient.status] || Clock
                        const bid = recipient.bids?.[0] || null
                        return (
                          <div
                            key={recipient.id}
                            className="p-5 border-2 border-green-200 rounded-lg bg-green-50 hover:shadow-md transition-shadow"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900 truncate mb-1">
                                    {recipient.subcontractor_name || 
                                     recipient.subcontractors?.name || 
                                     recipient.subcontractor_email}
                                  </div>
                                  <div className="text-sm text-gray-600 truncate">
                                    {recipient.subcontractor_email}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`text-xs ${statusColors[recipient.status] || 'bg-gray-100 text-gray-800'}`}>
                                  <StatusIcon className="h-3 w-3 mr-1 inline" />
                                  {recipient.status}
                                </Badge>
                                {bid && (
                                  <Badge variant="default" className="text-xs bg-green-600">
                                    Bid Received
                                  </Badge>
                                )}
                              </div>
                              {bid && (
                                <div className="pt-2 border-t border-green-200 space-y-2">
                                  {bid.bid_amount && (
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Amount: </span>
                                      <span className="text-green-700 font-semibold">
                                        ${Number(bid.bid_amount).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  {bid.timeline && (
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Timeline: </span>
                                      <span className="text-gray-900">{bid.timeline}</span>
                                    </div>
                                  )}
                                  {bid.status && (
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Status: </span>
                                      <Badge className={`text-xs ${bid.status === 'accepted' ? 'bg-green-100 text-green-800' : 
                                                         bid.status === 'declined' ? 'bg-red-100 text-red-800' : 
                                                         'bg-gray-100 text-gray-800'}`}>
                                        {bid.status}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              )}
                              {recipient.sent_at && (
                                <div className="text-xs text-gray-500 flex items-center pt-2 border-t border-green-200">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Sent: {new Date(recipient.sent_at).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recipients without Bids */}
                {recipientsWithoutBids.length > 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-700 mb-4 flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-gray-600" />
                      Pending ({recipientsWithoutBids.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {recipientsWithoutBids.map((recipient) => {
                        const StatusIcon = statusIcons[recipient.status] || Clock
                        return (
                          <div
                            key={recipient.id}
                            className="p-5 border rounded-lg bg-white hover:shadow-md transition-shadow"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate mb-1">
                                    {recipient.subcontractor_name || 
                                     recipient.subcontractors?.name || 
                                     recipient.subcontractor_email}
                                  </div>
                                  <div className="text-sm text-gray-600 truncate">
                                    {recipient.subcontractor_email}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${statusColors[recipient.status] || 'bg-gray-100 text-gray-800'}`}>
                                  <StatusIcon className="h-3 w-3 mr-1 inline" />
                                  {recipient.status}
                                </Badge>
                              </div>
                              {recipient.sent_at && (
                                <div className="text-xs text-gray-500 flex items-center pt-2 border-t">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Sent: {new Date(recipient.sent_at).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {recipients.length === 0 && (
                  <div className="text-center py-12 text-gray-500 text-lg">
                    No recipients found for this package
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 text-lg">
            Package not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

