'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  TrendingUp,
  Users,
  Clock,
  Lightbulb,
  Package,
  AlertCircle,
  Target
} from 'lucide-react'

interface BidNote {
  id: string
  note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string | null
  location: string | null
  content: string
  confidence_score: number
  created_at: string
}

interface Bid {
  id: string
  subcontractor_name?: string | null
  subcontractor_email?: string | null
  subcontractors?: {
    name: string
    email: string
  } | null
  bid_amount: number | null
  timeline: string | null
  bid_notes?: BidNote[]
}

interface JobSummaryPanelProps {
  jobRequest: {
    trade_category: string
    location: string
    description: string
    budget_range: string
  }
  bids: Bid[]
}

interface SummaryItem {
  type: 'concern' | 'requirement' | 'suggestion' | 'cost_savings' | 'timeline_issue'
  title: string
  description: string
  count: number
  contractors: string[]
  priority: 'high' | 'medium' | 'low'
  category?: string
}

export default function JobSummaryPanel({ jobRequest, bids }: JobSummaryPanelProps) {
  const allNotes = bids.flatMap(bid => 
    (bid.bid_notes || []).map(note => ({
      ...note,
      contractor: bid.subcontractors?.name || bid.subcontractor_name || bid.subcontractor_email || 'Unknown'
    }))
  )

  const summaryItems = generateSummaryItems(allNotes, bids, jobRequest.budget_range)

  if (summaryItems.length === 0) {
    return null
  }

  const priorityConfig = {
    high: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
    medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
    low: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle }
  }

  const typeConfig = {
    concern: { icon: AlertTriangle, color: 'text-red-600' },
    requirement: { icon: CheckCircle, color: 'text-green-600' },
    suggestion: { icon: Lightbulb, color: 'text-yellow-600' },
    cost_savings: { icon: DollarSign, color: 'text-green-600' },
    timeline_issue: { icon: Clock, color: 'text-orange-600' }
  }

  return (
    <Card className="mb-6 border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Target className="h-5 w-5 mr-2" />
          Project Summary & Key Insights
        </CardTitle>
        <p className="text-sm text-gray-600">
          Analysis of {bids.length} bids for {jobRequest.trade_category} work in {jobRequest.location}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {summaryItems.map((item, index) => {
            const priorityStyle = priorityConfig[item.priority]
            const typeStyle = typeConfig[item.type]
            const Icon = typeStyle.icon
            const PriorityIcon = priorityStyle.icon
            
            return (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${typeStyle.color}`} />
                    <Badge className={priorityStyle.color}>
                      <PriorityIcon className="h-3 w-3 mr-1" />
                      {item.priority.toUpperCase()}
                    </Badge>
                    {item.category && (
                      <Badge variant="outline">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{item.count} contractor{item.count > 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                
                <div className="text-xs text-gray-500">
                  Mentioned by: {item.contractors.join(', ')}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function generateSummaryItems(notes: (BidNote & { contractor: string })[], bids: Bid[], budgetRange: string): SummaryItem[] {
  const items: SummaryItem[] = []
  
  // Group notes by similar content
  const groupedNotes = new Map<string, (BidNote & { contractor: string })[]>()
  
  notes.forEach(note => {
    const normalizedContent = note.content.toLowerCase().trim()
    const key = `${note.category || 'other'}-${note.note_type}-${normalizedContent}`
    
    if (!groupedNotes.has(key)) {
      groupedNotes.set(key, [])
    }
    groupedNotes.get(key)!.push(note)
  })

  // Analyze patterns
  const requirements = notes.filter(n => n.note_type === 'requirement')
  const concerns = notes.filter(n => n.note_type === 'concern')
  const suggestions = notes.filter(n => n.note_type === 'suggestion')
  const timelineNotes = notes.filter(n => n.note_type === 'timeline')

  // Cost analysis
  const bidAmounts = bids.map(b => b.bid_amount).filter(Boolean) as number[]
  if (bidAmounts.length > 1) {
    const minBid = Math.min(...bidAmounts)
    const maxBid = Math.max(...bidAmounts)
    const avgBid = bidAmounts.reduce((sum, amount) => sum + amount, 0) / bidAmounts.length
    const savings = maxBid - minBid
    
    if (savings > 0) {
      items.push({
        type: 'cost_savings',
        title: 'Potential Cost Savings Identified',
        description: `Bid range: $${minBid.toLocaleString()} - $${maxBid.toLocaleString()}. Potential savings of $${savings.toLocaleString()} by choosing the lowest bid.`,
        count: bidAmounts.length,
        contractors: bids.filter(b => b.bid_amount === minBid).map(b => b.subcontractors?.name || b.subcontractor_name || b.subcontractor_email || 'Unknown'),
        priority: savings > avgBid * 0.2 ? 'high' : 'medium',
        category: 'Pricing'
      })
    }
  }

  // Timeline analysis
  const timelineIssues = timelineNotes.filter(n => 
    n.content.toLowerCase().includes('tight') || 
    n.content.toLowerCase().includes('delay') ||
    n.content.toLowerCase().includes('extend')
  )
  
  if (timelineIssues.length > 0) {
    const contractors = Array.from(new Set(timelineIssues.map(n => n.contractor)))
    items.push({
      type: 'timeline_issue',
      title: 'Timeline Concerns Raised',
      description: 'Multiple contractors have raised concerns about project timeline or potential delays.',
      count: contractors.length,
      contractors,
      priority: 'high',
      category: 'Timeline'
    })
  }

  // Requirements analysis
  const requirementCategories = requirements.reduce((acc, note) => {
    const category = note.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(note)
    return acc
  }, {} as Record<string, (BidNote & { contractor: string })[]>)

  Object.entries(requirementCategories).forEach(([category, reqs]) => {
    if (reqs.length >= 2) {
      const contractors = Array.from(new Set(reqs.map(n => n.contractor)))
      items.push({
        type: 'requirement',
        title: `${category} Requirements Consensus`,
        description: `Multiple contractors agree on specific ${category.toLowerCase()} requirements for this project.`,
        count: contractors.length,
        contractors,
        priority: reqs.length >= 3 ? 'high' : 'medium',
        category
      })
    }
  })

  // Concerns analysis
  const concernCategories = concerns.reduce((acc, note) => {
    const category = note.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(note)
    return acc
  }, {} as Record<string, (BidNote & { contractor: string })[]>)

  Object.entries(concernCategories).forEach(([category, concerns]) => {
    if (concerns.length >= 2) {
      const contractors = Array.from(new Set(concerns.map(n => n.contractor)))
      items.push({
        type: 'concern',
        title: `${category} Concerns Identified`,
        description: `Multiple contractors have raised concerns about ${category.toLowerCase()} aspects of this project.`,
        count: contractors.length,
        contractors,
        priority: 'high',
        category
      })
    }
  })

  // Suggestions analysis
  const suggestionCategories = suggestions.reduce((acc, note) => {
    const category = note.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(note)
    return acc
  }, {} as Record<string, (BidNote & { contractor: string })[]>)

  Object.entries(suggestionCategories).forEach(([category, suggestions]) => {
    if (suggestions.length >= 2) {
      const contractors = Array.from(new Set(suggestions.map(n => n.contractor)))
      items.push({
        type: 'suggestion',
        title: `${category} Improvement Suggestions`,
        description: `Multiple contractors have suggested improvements for ${category.toLowerCase()} aspects of this project.`,
        count: contractors.length,
        contractors,
        priority: 'medium',
        category
      })
    }
  })

  // Sort by priority and count
  return items.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    }
    return b.count - a.count
  })
}
