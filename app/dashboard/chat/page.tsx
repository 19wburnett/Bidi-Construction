'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Send, Loader2, FileText, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { listJobsForUser } from '@/lib/job-access'

interface Plan {
  id: string
  title: string | null
  file_name: string
  job_id: string | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export default function ChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      loadPlans()
    }
  }, [user])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    if (selectedPlanId && selectedJobId) {
      loadChatHistory()
    } else {
      setMessages([])
    }
  }, [selectedPlanId, selectedJobId])

  async function loadPlans() {
    try {
      if (!user) return

      setIsLoadingPlans(true)
      const memberships = await listJobsForUser(supabase, user.id, 'id')
      const jobIds = memberships.map(({ job }) => job.id).filter(Boolean) as string[]

      if (jobIds.length === 0) {
        setPlans([])
        setIsLoadingPlans(false)
        return
      }

      const { data, error } = await supabase
        .from('plans')
        .select('id, title, file_name, job_id')
        .in('job_id', jobIds)
        .not('job_id', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      setPlans(data || [])
      
      // Auto-select first plan if available
      if (data && data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(data[0].id)
        setSelectedJobId(data[0].job_id || '')
      }
    } catch (error) {
      console.error('Error loading plans:', error)
    } finally {
      setIsLoadingPlans(false)
      setIsLoading(false)
    }
  }

  async function loadChatHistory() {
    if (!selectedPlanId || !selectedJobId) return

    try {
      setIsLoading(true)
      const response = await fetch(
        `/api/plan-chat?jobId=${encodeURIComponent(selectedJobId)}&planId=${encodeURIComponent(selectedPlanId)}`
      )

      if (response.ok) {
        const data = await response.json()
        if (data.chatHistory && Array.isArray(data.chatHistory)) {
          setMessages(
            data.chatHistory.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at,
            }))
          )
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendMessage() {
    const trimmed = input.trim()
    if (!trimmed || isSending || !selectedPlanId || !selectedJobId) return

    setInput('')
    setIsSending(true)

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await fetch('/api/plan-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: selectedJobId,
          planId: selectedPlanId,
          messages: [...messages, userMessage].map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to get a response')
      }

      const payload: { reply: string } = await response.json()
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: payload.reply.trim(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat request failed:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Blueprint Chat</h1>
              <p className="text-sm text-gray-500">Ask questions about your uploaded blueprints</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/plans')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            View Plans
          </Button>
        </div>
      </div>

      {/* Plan Selector */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Select Blueprint:</label>
            <Select
              value={selectedPlanId}
              onValueChange={(value) => {
                const plan = plans.find((p) => p.id === value)
                setSelectedPlanId(value)
                setSelectedJobId(plan?.job_id || '')
                setMessages([])
              }}
              disabled={isLoadingPlans}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Choose a blueprint to chat about" />
              </SelectTrigger>
              <SelectContent>
                {plans.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {isLoadingPlans ? 'Loading plans...' : 'No blueprints available'}
                  </SelectItem>
                ) : (
                  plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title || plan.file_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedPlan && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MessageSquare className="h-4 w-4" />
                <span>{messages.length} messages</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-4xl">
          {!selectedPlanId ? (
            <div className="flex h-full items-center justify-center">
              <Card className="w-full max-w-md">
                <CardContent className="p-8 text-center">
                  <Bot className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    Select a Blueprint
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Choose a blueprint from the dropdown above to start chatting about it.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                <p className="mt-4 text-sm text-gray-500">Loading chat history...</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-2xl text-center">
                        <Bot className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-semibold text-gray-900">
                          Start a conversation
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          Ask me anything about <strong>{selectedPlan?.title || selectedPlan?.file_name}</strong>.
                          I can help you understand the blueprint, find specific information, or answer questions
                          about the plan details.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          {[
                            'What notes are on the cover sheet?',
                            'Summarize the key features of this plan',
                            'What materials are specified?',
                            'Tell me about the dimensions',
                          ].map((prompt) => (
                            <Button
                              key={prompt}
                              variant="outline"
                              className="justify-start text-left"
                              onClick={() => setInput(prompt)}
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-4 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100">
                            <Bot className="h-5 w-5 text-orange-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-orange-600 text-white'
                              : 'bg-white text-gray-900 shadow-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        </div>
                        {message.role === 'user' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
                            <span className="text-sm font-medium text-gray-700">You</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {isSending && (
                    <div className="flex gap-4 justify-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100">
                        <Bot className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          <span className="text-sm text-gray-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 bg-white px-6 py-4">
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Ask a question about the blueprint..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    disabled={isSending}
                    rows={3}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isSending}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400"
                    size="icon"
                  >
                    {isSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Press Enter to send, Shift+Enter for a new line
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

