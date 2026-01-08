'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Bot, Send, X, Sparkles, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface EmailTemplateAIAssistantProps {
  isOpen: boolean
  onClose: () => void
  htmlBody: string
  subject: string
  branding?: {
    companyName?: string
    primaryColor?: string
    fontFamily?: string
  }
  onApply: (htmlBody: string, subject: string) => void
}

export default function EmailTemplateAIAssistant({
  isOpen,
  onClose,
  htmlBody,
  subject,
  branding,
  onApply
}: EmailTemplateAIAssistantProps) {
  const [mode, setMode] = useState<'generate' | 'improve'>('generate')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [lastGenerated, setLastGenerated] = useState<{ htmlBody: string; subject: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    setInput('')
    setIsSending(true)

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await fetch('/api/email-templates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode,
          prompt: trimmed,
          currentTemplate: mode === 'improve' ? htmlBody : undefined,
          subject: mode === 'improve' ? subject : undefined,
          branding
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to generate template')
      }

      const data = await response.json()

      if (!data.success || !data.html_body) {
        throw new Error('Invalid response from server')
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `I've generated an email template for you. You can review it below and apply it to your template.`
      }

      setMessages((prev) => [...prev, assistantMessage])
      setLastGenerated({
        htmlBody: data.html_body,
        subject: data.subject || subject
      })
    } catch (error) {
      console.error('Error generating template:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const handleApply = () => {
    if (lastGenerated) {
      onApply(lastGenerated.htmlBody, lastGenerated.subject)
      setLastGenerated(null)
    }
  }

  const handleClear = () => {
    setMessages([])
    setLastGenerated(null)
    setInput('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white border-l border-gray-200 shadow-lg z-[100] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold text-gray-900">AI Assistant</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Mode Tabs */}
      <div className="px-4 pt-4 border-b border-gray-200">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'generate' | 'improve')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate" className="text-xs">
              Generate
            </TabsTrigger>
            <TabsTrigger value="improve" className="text-xs">
              Improve
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-500 mt-8">
            <Bot className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="mb-1">
              {mode === 'generate'
                ? 'Describe the email template you want to create'
                : 'Tell me how you want to improve your current template'}
            </p>
            <p className="text-xs">
              I'll help you create a text-based, employee-style email template
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-2',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 flex-shrink-0 mt-1">
                <Bot className="h-3 w-3 text-orange-600" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm max-w-[80%]',
                message.role === 'user'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              {message.content}
            </div>
            {message.role === 'user' && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 flex-shrink-0 mt-1">
                <span className="text-xs text-gray-600">You</span>
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex gap-2 justify-start">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 flex-shrink-0 mt-1">
              <Bot className="h-3 w-3 text-orange-600" />
            </div>
            <div className="rounded-lg px-3 py-2 bg-gray-100">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        {lastGenerated && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Generated Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-gray-600">
                <strong>Subject:</strong> {lastGenerated.subject}
              </div>
              <Button
                size="sm"
                onClick={handleApply}
                className="w-full"
                variant="default"
              >
                <Check className="h-3 w-3 mr-2" />
                Apply to Template
              </Button>
            </CardContent>
          </Card>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="w-full text-xs"
          >
            Clear Conversation
          </Button>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              mode === 'generate'
                ? 'Describe your email template...'
                : 'How should I improve the template?'
            }
            rows={3}
            className="resize-none"
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            size="sm"
            className="self-end"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
