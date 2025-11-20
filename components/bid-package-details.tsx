'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Package, Users, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { BidPackage } from '@/types/takeoff'

interface BidPackageDetailsProps {
  bidPackageId: string | null
  bidPackage?: BidPackage | null
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
  } | null
}

export default function BidPackageDetails({ bidPackageId, bidPackage }: BidPackageDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [packageData, setPackageData] = useState<BidPackage | null>(bidPackage || null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isExpanded && bidPackageId) {
      loadRecipients()
      // If we don't have package data, fetch it
      if (!packageData && bidPackageId) {
        loadPackageData()
      }
    }
  }, [isExpanded, bidPackageId])

  async function loadPackageData() {
    if (!bidPackageId) return
    
    try {
      const { data, error } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('id', bidPackageId)
        .single()
      
      if (!error && data) {
        setPackageData(data)
      }
    } catch (error) {
      console.error('Error loading package data:', error)
    }
  }

  async function loadRecipients() {
    if (!bidPackageId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/bid-packages/${bidPackageId}/recipients`)
      if (response.ok) {
        const data = await response.json()
        setRecipients(data.recipients || [])
      }
    } catch (error) {
      console.error('Error loading recipients:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!bidPackageId && !bidPackage) {
    return null
  }

  // Handle minimum_line_items which might be a JSON string or array
  let lineItems: any[] = []
  if (packageData?.minimum_line_items) {
    if (typeof packageData.minimum_line_items === 'string') {
      try {
        const parsed = JSON.parse(packageData.minimum_line_items)
        lineItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.takeoffs || [])
      } catch {
        lineItems = []
      }
    } else if (Array.isArray(packageData.minimum_line_items)) {
      lineItems = packageData.minimum_line_items
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

  return (
    <Card className="mt-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center">
            <Package className="h-4 w-4 mr-2 text-orange-600" />
            Bid Package Details
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show Details
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Package Info */}
          {packageData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Trade Category:</span>
                <Badge variant="outline">{packageData.trade_category}</Badge>
              </div>
              {packageData.description && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Description:</span>
                  <p className="text-sm text-gray-600 mt-1">{packageData.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div>
              <div className="flex items-center mb-2">
                <FileText className="h-4 w-4 mr-2 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Package Contents ({lineItems.length} items)
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                <div className="space-y-2">
                  {lineItems.map((item: any, index: number) => (
                    <div key={index} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {item.description || item.name || item.item_name || `Item ${index + 1}`}
                          </div>
                          {item.category && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Category: {item.category}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          {item.quantity !== undefined && (
                            <div className="text-sm font-medium text-gray-900">
                              {item.quantity} {item.unit || ''}
                            </div>
                          )}
                          {item.unit_cost !== undefined && item.unit_cost !== null && (
                            <div className="text-xs text-gray-500">
                              ${Number(item.unit_cost).toLocaleString()}/{item.unit || 'unit'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Sent To ({recipients.length} recipient{recipients.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-4 text-sm text-gray-500">
                Loading recipients...
              </div>
            ) : recipients.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500 border rounded-lg bg-gray-50">
                No recipients found for this package
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {recipient.subcontractor_name || 
                           recipient.subcontractors?.name || 
                           recipient.subcontractor_email}
                        </span>
                        <Badge className={`text-xs ${statusColors[recipient.status] || 'bg-gray-100 text-gray-800'}`}>
                          {recipient.status}
                        </Badge>
                        {recipient.bid_id && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Bid Received
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        {recipient.subcontractor_email}
                      </div>
                      {recipient.sent_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Sent: {new Date(recipient.sent_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

