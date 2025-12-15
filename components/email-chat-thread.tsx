'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Mail, X } from 'lucide-react'

interface EmailChatThreadProps {
  selectedEmailRecipient: any
  emailThreads: Record<string, any>
  fetchedEmailContent: Record<string, string>
  fetchingEmailContent: Set<string>
  setFetchedEmailContent: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setFetchingEmailContent: React.Dispatch<React.SetStateAction<Set<string>>>
  setEmailThreads: React.Dispatch<React.SetStateAction<Record<string, any>>>
  showEmailResponseForm: boolean
  setShowEmailResponseForm: (show: boolean) => void
  responseText: string
  setResponseText: (text: string) => void
  sendingResponse: boolean
  setSendingResponse: (sending: boolean) => void
  onSendMessage: () => Promise<void>
  onClose?: () => void
  onViewBid?: () => void
  hasBid?: boolean
  error?: string
}

export function EmailChatThread({
  selectedEmailRecipient,
  emailThreads,
  fetchedEmailContent,
  fetchingEmailContent,
  setFetchedEmailContent,
  setFetchingEmailContent,
  setEmailThreads,
  showEmailResponseForm,
  setShowEmailResponseForm,
  responseText,
  setResponseText,
  sendingResponse,
  setSendingResponse,
  onSendMessage,
  onClose,
  onViewBid,
  hasBid = false,
  error
}: EmailChatThreadProps) {
  // Helper to get initials
  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  
  // Helper to format time for chat
  const formatChatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Get thread messages
  const threadId = selectedEmailRecipient.thread_id || 
    `thread-${selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id}-${selectedEmailRecipient.subcontractor_email}`
  const thread = emailThreads[threadId]
  const threadMessages = thread?.messages || [selectedEmailRecipient]
  
  // Sort messages by timestamp
  const sortedMessages = [...threadMessages].sort((a, b) => {
    const timeA = new Date(a.messageTimestamp || a.responded_at || a.sent_at || a.created_at).getTime()
    const timeB = new Date(b.messageTimestamp || b.responded_at || b.sent_at || b.created_at).getTime()
    return timeA - timeB
  })

  // Auto-scroll to bottom when new messages arrive
  const messagesEndRef = useState<HTMLDivElement | null>(null)[0]
  useEffect(() => {
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sortedMessages.length, messagesEndRef])

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedEmailRecipient.subcontractor_name || selectedEmailRecipient.subcontractors?.name || selectedEmailRecipient.subcontractor_email}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
              {selectedEmailRecipient.status}
            </span>
            <span className="text-xs text-gray-500">
              {selectedEmailRecipient.bid_packages?.trade_category || 'General'}
            </span>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-gray-50">
        {sortedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">No messages yet</p>
          </div>
        ) : (
          sortedMessages.map((message: any, index: number) => {
            // Use explicit isFromGC from API (fallback to false for safety)
            const isFromGC = message.isFromGC ?? false
            const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
            const messageTime = new Date(message.responded_at || message.sent_at || message.created_at)
            const senderName = isFromGC ? 'You' : (message.subcontractor_name || message.subcontractors?.name || message.subcontractor_email || 'Subcontractor')
            const prevMessage = index > 0 ? sortedMessages[index - 1] : null
            const showAvatar = !prevMessage || prevMessage.isFromGC !== isFromGC
            
            // Fetch email content if missing
            if (!messageContent && message.resend_email_id && !fetchingEmailContent.has(message.id) && !fetchedEmailContent[message.id]) {
              setFetchingEmailContent(prev => new Set(prev).add(message.id))
              fetch(`/api/emails/${message.resend_email_id}/content`)
                .then(res => res.json())
                .then(data => {
                  if (data.content) {
                    setFetchedEmailContent(prev => ({
                      ...prev,
                      [message.id]: data.content
                    }))
                    setEmailThreads(prev => {
                      const updated = { ...prev }
                      const threadId = message.thread_id || 
                        `thread-${message.bid_package_id || message.bid_packages?.id}-${message.subcontractor_email}`
                      if (updated[threadId]) {
                        const updatedThread = { ...updated[threadId] }
                        updatedThread.messages = updatedThread.messages.map((m: any) =>
                          m.id === message.id ? { ...m, response_text: data.content } : m
                        )
                        updatedThread.latest_message = updatedThread.latest_message?.id === message.id
                          ? { ...updatedThread.latest_message, response_text: data.content }
                          : updatedThread.latest_message
                        updated[threadId] = updatedThread
                      }
                      return updated
                    })
                  }
                })
                .catch(err => console.error('Failed to fetch email content:', err))
                .finally(() => {
                  setFetchingEmailContent(prev => {
                    const next = new Set(prev)
                    next.delete(message.id)
                    return next
                  })
                })
            }
            
            return (
              <div
                key={message.id || `message-${index}`}
                className={`flex items-end gap-2 ${isFromGC ? 'flex-row-reverse' : 'flex-row'} ${showAvatar ? 'mt-4' : 'mt-1'}`}
              >
                {/* Avatar */}
                {showAvatar ? (
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ${
                    isFromGC 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {isFromGC ? 'Y' : getInitials(senderName)}
                  </div>
                ) : (
                  <div className="w-8" />
                )}
                
                {/* Message Bubble */}
                <div className={`flex flex-col max-w-[75%] ${isFromGC ? 'items-end' : 'items-start'}`}>
                  {showAvatar && (
                    <span className={`text-xs text-gray-500 mb-1 px-1 ${isFromGC ? 'text-right' : 'text-left'}`}>
                      {senderName}
                    </span>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                    isFromGC
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                  }`}>
                    {fetchingEmailContent.has(message.id) ? (
                      <div className="flex items-center gap-2">
                        <div className={`animate-spin rounded-full h-3 w-3 border-2 ${isFromGC ? 'border-white border-t-transparent' : 'border-gray-400 border-t-transparent'}`}></div>
                        <span className="text-xs">Loading...</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {messageContent || (isFromGC ? 'Email sent' : 'No message content available')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs text-gray-400 mt-1 px-1 ${isFromGC ? 'text-right' : 'text-left'}`}>
                    {formatChatTime(messageTime)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={(el) => { (messagesEndRef as any) = el }} />
      </div>

      {/* Reply Input - Chat-like */}
      <div className="border-t bg-white p-4 flex-shrink-0">
        {!showEmailResponseForm ? (
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowEmailResponseForm(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Message
            </Button>
            {hasBid && onViewBid && (
              <Button variant="outline" onClick={onViewBid}>
                View Bid
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Type a message..."
                rows={3}
                className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (responseText.trim() && !sendingResponse) {
                      onSendMessage()
                    }
                  }
                }}
              />
              <Button
                size="icon"
                disabled={sendingResponse || !responseText.trim()}
                onClick={onSendMessage}
                className="bg-blue-600 hover:bg-blue-700 h-10 w-10"
              >
                {sendingResponse ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowEmailResponseForm(false)
                  setResponseText('')
                }}
              >
                Cancel
              </Button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

