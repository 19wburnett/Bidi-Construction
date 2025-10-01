'use client'

import { Button } from '@/components/ui/button'
import { Mail, Copy } from 'lucide-react'
import { useState } from 'react'

interface EmailDraftButtonProps {
  jobRequest: {
    trade_category: string
    location: string
    description: string
    budget_range: string
  }
  bids: Array<{
    subcontractor_name: string | null
    bid_amount: number | null
    timeline: string | null
    bid_notes?: Array<{
      note_type: string
      category: string | null
      content: string
    }>
  }>
}

export default function EmailDraftButton({ jobRequest, bids }: EmailDraftButtonProps) {
  const [copied, setCopied] = useState(false)

  const generateEmailContent = () => {
    // Extract common patterns from bids
    const allNotes = bids.flatMap(bid => bid.bid_notes || [])
    const requirements = allNotes.filter(note => note.note_type === 'requirement')
    const concerns = allNotes.filter(note => note.note_type === 'concern')
    const suggestions = allNotes.filter(note => note.note_type === 'suggestion')

    // Group notes by category
    const requirementsByCategory = requirements.reduce((acc, note) => {
      const category = note.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(note.content)
      return acc
    }, {} as Record<string, string[]>)

    const concernsByCategory = concerns.reduce((acc, note) => {
      const category = note.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(note.content)
      return acc
    }, {} as Record<string, string[]>)

    const suggestionsByCategory = suggestions.reduce((acc, note) => {
      const category = note.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(note.content)
      return acc
    }, {} as Record<string, string[]>)

    // Generate email content
    let emailBody = `Subject: Project Update - ${jobRequest.trade_category} Work in ${jobRequest.location}

Dear Architect,

I wanted to provide you with an update on the ${jobRequest.trade_category} project in ${jobRequest.location}. We've received ${bids.length} bids and I'd like to share the key findings and requirements that have emerged.

PROJECT OVERVIEW:
- Trade: ${jobRequest.trade_category}
- Location: ${jobRequest.location}
- Budget Range: ${jobRequest.budget_range}
- Description: ${jobRequest.description}

BID SUMMARY:
${bids.map((bid, index) => {
  const amount = bid.bid_amount ? `$${bid.bid_amount.toLocaleString()}` : 'Amount TBD'
  const timeline = bid.timeline || 'Timeline TBD'
  return `${index + 1}. ${bid.subcontractor_name || 'Unknown Contractor'}: ${amount} - ${timeline}`
}).join('\n')}

KEY REQUIREMENTS IDENTIFIED:
${Object.entries(requirementsByCategory).map(([category, reqs]) => 
  `${category.toUpperCase()}:\n${reqs.map(req => `• ${req}`).join('\n')}`
).join('\n\n')}

CONCERNS TO ADDRESS:
${Object.entries(concernsByCategory).map(([category, concerns]) => 
  `${category.toUpperCase()}:\n${concerns.map(concern => `• ${concern}`).join('\n')}`
).join('\n\n')}

SUGGESTIONS FOR CONSIDERATION:
${Object.entries(suggestionsByCategory).map(([category, suggestions]) => 
  `${category.toUpperCase()}:\n${suggestions.map(suggestion => `• ${suggestion}`).join('\n')}`
).join('\n\n')}

NEXT STEPS:
Please review the attached plans and let me know if any modifications are needed based on these requirements and concerns. I'd like to schedule a call to discuss the project details and timeline.

Best regards,
[Your Name]`

    return emailBody
  }

  const handleEmailDraft = () => {
    const emailContent = generateEmailContent()
    const subject = `Project Update - ${jobRequest.trade_category} Work in ${jobRequest.location}`
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailContent)}`
    window.open(mailtoLink)
  }

  const handleCopyToClipboard = async () => {
    const emailContent = generateEmailContent()
    try {
      await navigator.clipboard.writeText(emailContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  return (
    <div className="flex space-x-2">
      <Button 
        onClick={handleEmailDraft}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2"
      >
        <Mail className="h-4 w-4" />
        <span>Email Draft</span>
      </Button>
      
      <Button 
        onClick={handleCopyToClipboard}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2"
      >
        <Copy className="h-4 w-4" />
        <span>{copied ? 'Copied!' : 'Copy Text'}</span>
      </Button>
    </div>
  )
}
