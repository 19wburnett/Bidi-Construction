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
import { Bot, Send, Loader2, FileText, MessageSquare, Sparkles, Plus, Trash2, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { listJobsForUser } from '@/lib/job-access'
import { AVAILABLE_CHAT_MODELS, DEFAULT_CHAT_MODEL } from '@/lib/plan-chat-models'

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

interface ChatSession {
  id: string
  title: string | null
  description: string | null
  created_at: string
  updated_at: string
  last_message_at: string | null
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
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plan-chat-selected-model') || DEFAULT_CHAT_MODEL
    }
    return DEFAULT_CHAT_MODEL
  })
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
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
      loadChatSessions()
      loadChatHistory()
    } else {
      setMessages([])
      setChatSessions([])
      setSelectedChatId(null)
    }
  }, [selectedPlanId, selectedJobId])

  useEffect(() => {
    if (selectedChatId) {
      loadChatHistory()
    }
  }, [selectedChatId])

  useEffect(() => {
    // Save model preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('plan-chat-selected-model', selectedModel)
    }
  }, [selectedModel])

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

  async function loadChatSessions() {
    if (!selectedPlanId || !selectedJobId) return

    setIsLoadingChats(true)
    try {
      const response = await fetch(
        `/api/plan-chat/sessions?jobId=${encodeURIComponent(selectedJobId)}&planId=${encodeURIComponent(selectedPlanId)}`
      )

      if (response.ok) {
        const data = await response.json()
        setChatSessions(data.sessions || [])
        
        // Auto-select most recent chat if available
        if (data.sessions && data.sessions.length > 0 && !selectedChatId) {
          setSelectedChatId(data.sessions[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    } finally {
      setIsLoadingChats(false)
    }
  }

  async function createNewChat() {
    if (!selectedPlanId || !selectedJobId) return

    try {
      const response = await fetch('/api/plan-chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobId, planId: selectedPlanId }),
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedChatId(data.session.id)
        setMessages([])
        await loadChatSessions()
      }
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  async function deleteChat(chatIdToDelete: string) {
    if (!confirm('Are you sure you want to delete this chat? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/plan-chat/sessions?chatId=${encodeURIComponent(chatIdToDelete)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadChatSessions()
        if (selectedChatId === chatIdToDelete) {
          const remainingChats = chatSessions.filter(c => c.id !== chatIdToDelete)
          if (remainingChats.length > 0) {
            setSelectedChatId(remainingChats[0].id)
          } else {
            setSelectedChatId(null)
            setMessages([])
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error)
    }
  }

  async function loadChatHistory() {
    if (!selectedPlanId || !selectedJobId) return

    try {
      setIsLoading(true)
      const url = `/api/plan-chat?jobId=${encodeURIComponent(selectedJobId)}&planId=${encodeURIComponent(selectedPlanId)}${selectedChatId ? `&chatId=${encodeURIComponent(selectedChatId)}` : ''}`
      const response = await fetch(url)

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
              model: selectedModel,
              chatId: selectedChatId,
            }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to get a response')
      }

      const payload: { reply: string; chatId?: string } = await response.json()
      
      // Validate that reply exists
      if (!payload.reply || typeof payload.reply !== 'string') {
        throw new Error('Invalid response: missing or invalid reply')
      }
      
      // Update selected chat ID if a new one was created
      if (payload.chatId && payload.chatId !== selectedChatId) {
        setSelectedChatId(payload.chatId)
        await loadChatSessions()
      }
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: payload.reply.trim(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      
      // Refresh chat sessions after a short delay to pick up AI-generated title
      // Title generation happens async, so wait a bit before refreshing
      setTimeout(() => {
        loadChatSessions()
      }, 2000)
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
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Select Blueprint:</label>
              <Select
                value={selectedPlanId}
                onValueChange={(value) => {
                  const plan = plans.find((p) => p.id === value)
                  setSelectedPlanId(value)
                  setSelectedJobId(plan?.job_id || '')
                  setMessages([])
                  setSelectedChatId(null)
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
            </div>
            {selectedPlanId && (
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Chat:</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {selectedChatId 
                        ? chatSessions.find(c => c.id === selectedChatId)?.title || 'Chat'
                        : 'New Chat'}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={createNewChat}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Chat
                    </Button>
                    <div className="border-t my-2" />
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {chatSessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between group hover:bg-gray-50 rounded px-2 py-1.5"
                        >
                          <button
                            className="flex-1 text-left"
                            onClick={() => {
                              setSelectedChatId(session.id)
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-gray-400" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {session.title || 'Untitled Chat'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(session.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteChat(session.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {selectedPlan && (
              <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto">
                <MessageSquare className="h-4 w-4" />
                <span>{messages.length} messages</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="mx-auto h-full max-w-3xl flex flex-col">
          {!selectedPlanId ? (
            <div className="flex h-full items-center justify-center">
              <Card className="w-full max-w-md border-0 shadow-lg">
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
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-0">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 py-12">
                      <div className="max-w-2xl w-full text-center">
                        <div className="mb-6">
                          <Bot className="mx-auto h-16 w-16 text-gray-300" />
                        </div>
                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                          How can I help you today?
                        </h3>
                        <p className="text-sm text-gray-500 mb-8">
                          Ask me anything about <strong>{selectedPlan?.title || selectedPlan?.file_name}</strong>.
                          I can help you understand the blueprint, find specific information, or answer questions
                          about the plan details.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 max-w-xl mx-auto">
                          {[
                            'What notes are on the cover sheet?',
                            'Summarize the key features of this plan',
                            'What materials are specified?',
                            'Tell me about the dimensions',
                          ].map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => setInput(prompt)}
                              className="px-4 py-3 text-sm text-left rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-gray-700"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`group py-6 px-4 md:px-8 hover:bg-gray-50/50 transition-colors ${
                          message.role === 'user' ? 'bg-gray-50' : 'bg-white'
                        }`}
                      >
                        <div className="mx-auto max-w-3xl flex gap-4 md:gap-6">
                          {message.role === 'assistant' && (
                            <div className="flex-shrink-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm">
                                <Bot className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-500">
                                {message.role === 'user' ? 'You' : 'AI Assistant'}
                              </span>
                            </div>
                            <div className="prose prose-sm max-w-none">
                              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                                {message.content}
                              </p>
                            </div>
                          </div>
                          {message.role === 'user' && (
                            <div className="flex-shrink-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-400 to-gray-600 shadow-sm">
                                <span className="text-xs font-semibold text-white">U</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isSending && (
                    <div className="py-6 px-4 md:px-8 bg-white">
                      <div className="mx-auto max-w-3xl flex gap-4 md:gap-6">
                        <div className="flex-shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 bg-white">
                <div className="mx-auto max-w-3xl px-4 md:px-8 py-4">
                  <div className="relative flex items-end gap-3 rounded-2xl border border-gray-300 bg-white shadow-sm hover:border-gray-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                    <Textarea
                      placeholder="Message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      disabled={isSending}
                      rows={1}
                      className="min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = `${Math.min(target.scrollHeight, 200)}px`
                      }}
                    />
                    <div className="flex-shrink-0 pb-2 pr-2">
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isSending}
                        className="h-9 w-9 rounded-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
                        size="icon"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <Send className="h-4 w-4 text-white" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isSending}>
                      <SelectTrigger className="h-7 w-auto border-0 bg-transparent text-xs text-gray-500 hover:text-gray-700 px-0">
                        <Sparkles className="mr-1.5 h-3 w-3" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_CHAT_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{model.name}</span>
                              <span className="text-xs text-gray-500">{model.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      AI can make mistakes. Check important info.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

