'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Lightbulb, 
  Package,
  MessageSquare,
  Users
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
  subcontractor_name: string | null
  bid_notes?: BidNote[]
}

interface PatternSummaryProps {
  bids: Bid[]
}

interface Pattern {
  type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material'
  category: string
  location: string | null
  content: string
  count: number
  confidence: number
  contractors: string[]
}

export default function PatternSummary({ bids }: PatternSummaryProps) {
  // Extract all notes from all bids
  const allNotes = bids.flatMap(bid => 
    (bid.bid_notes || []).map(note => ({
      ...note,
      contractor: bid.subcontractor_name || 'Unknown'
    }))
  )

  if (allNotes.length === 0) {
    return null
  }

  // Analyze patterns
  const patterns = analyzePatterns(allNotes)

  if (patterns.length === 0) {
    return null
  }

  const noteTypeConfig = {
    requirement: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      label: 'Requirements'
    },
    concern: {
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-800',
      label: 'Concerns'
    },
    suggestion: {
      icon: Lightbulb,
      color: 'bg-yellow-100 text-yellow-800',
      label: 'Suggestions'
    },
    timeline: {
      icon: Clock,
      color: 'bg-blue-100 text-blue-800',
      label: 'Timeline'
    },
    material: {
      icon: Package,
      color: 'bg-purple-100 text-purple-800',
      label: 'Materials'
    }
  }

  return (
    <Card className="mb-6 border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <TrendingUp className="h-5 w-5 mr-2" />
          Pattern Summary
        </CardTitle>
        <p className="text-sm text-gray-600">
          Common themes and requirements mentioned across {bids.length} bids
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map((pattern, index) => {
            const config = noteTypeConfig[pattern.type]
            const Icon = config.icon
            
            return (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <Badge className={config.color}>
                      {config.label}
                    </Badge>
                    <Badge variant="outline">
                      {pattern.category}
                    </Badge>
                    {pattern.location && (
                      <Badge variant="outline">
                        {pattern.location.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{pattern.count} contractor{pattern.count > 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-800 mb-2">{pattern.content}</p>
                
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Mentioned by: {pattern.contractors.join(', ')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.round(pattern.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function analyzePatterns(notes: (BidNote & { contractor: string })[]): Pattern[] {
  // Group notes by similar content and category
  const groupedNotes = new Map<string, (BidNote & { contractor: string })[]>()
  
  notes.forEach(note => {
    // Create a key based on category and normalized content
    const normalizedContent = note.content.toLowerCase().trim()
    const key = `${note.category || 'other'}-${note.note_type}-${normalizedContent}`
    
    if (!groupedNotes.has(key)) {
      groupedNotes.set(key, [])
    }
    groupedNotes.get(key)!.push(note)
  })

  // Convert to patterns, filtering for groups with 2+ notes
  const patterns: Pattern[] = []
  
  groupedNotes.forEach((groupNotes, key) => {
    if (groupNotes.length >= 2) {
      const firstNote = groupNotes[0]
      const contractors = [...new Set(groupNotes.map(n => n.contractor))]
      const avgConfidence = groupNotes.reduce((sum, n) => sum + n.confidence_score, 0) / groupNotes.length
      
      patterns.push({
        type: firstNote.note_type,
        category: firstNote.category || 'other',
        location: firstNote.location,
        content: firstNote.content,
        count: groupNotes.length,
        confidence: avgConfidence,
        contractors
      })
    }
  })

  // Sort by count (most mentioned first) and confidence
  return patterns.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count
    }
    return b.confidence - a.confidence
  })
}
