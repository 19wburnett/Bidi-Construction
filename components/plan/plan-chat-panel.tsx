'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  Loader2,
  MessageCircleQuestion,
  Send,
  TriangleAlert,
  User as UserIcon,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AVAILABLE_CHAT_MODELS, DEFAULT_CHAT_MODEL, type ChatModel } from '@/lib/plan-chat-models'

type PlanChatRole = 'user' | 'assistant'

export interface PlanChatMessage {
  id: string
  role: PlanChatRole
  content: string
}

interface PlanChatPanelProps {
  jobId: string
  planId: string
}

interface ChatStatusResponse {
  hasTakeoff: boolean
  lastUpdated?: string | null
  itemCount?: number
  summaryCategories?: Array<{ category: string; totalQuantity: number; unit?: string }>
  chatHistory?: Array<{ id: string; role: 'user' | 'assistant'; content: string; created_at: string }>
}

interface ChatSession {
  id: string
  title: string | null
  description: string | null
  created_at: string
  updated_at: string
  last_message_at: string | null
}

interface ChatErrorState {
  type: 'missing-takeoff' | 'request-failed' | 'unauthorized' | 'unknown' | 'vectorization-failed'
  message: string
  details?: string
}

const examplePrompts = [
  'What notes are listed on the cover sheet about fire protection?',
  'Summarize the footing quantities from the takeoff.',
  'Which page mentions door hardware requirements and what does it say?',
  'How many square feet of roofing are included and where?'
]


function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600"
      aria-live="polite"
    >
      <Bot className="h-3.5 w-3.5 text-orange-500" />
      <span className="font-medium text-gray-700">Thinking</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

const MODEL_STORAGE_KEY = 'plan-chat-selected-model'

export function PlanChatPanel({ jobId, planId }: PlanChatPanelProps) {
  const [messages, setMessages] = useState<PlanChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isVectorizing, setIsVectorizing] = useState(false)
  const [vectorizationProgress, setVectorizationProgress] = useState<number | null>(null)
  const [status, setStatus] = useState<ChatStatusResponse | null>(null)
  const [error, setError] = useState<ChatErrorState | null>(null)
  const [missingTakeoff, setMissingTakeoff] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_CHAT_MODEL
    }
    return DEFAULT_CHAT_MODEL
  })
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const hasHydratedMessagesRef = useRef(false)

  const hasActiveConversation = messages.length > 0
  const canChat = !error

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    hasHydratedMessagesRef.current = false
    setMessages([])
    setInput('')
    setStatus(null)
    setError(null)
    setMissingTakeoff(false)
    setSelectedChatId(null)

    hasHydratedMessagesRef.current = true
    loadChatSessions()
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, planId])

  useEffect(() => {
    if (selectedChatId) {
      fetchStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId])

  useEffect(() => {
    // Save model preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel)
    }
  }, [selectedModel])


  const summaryPreview = useMemo(() => {
    if (!status?.summaryCategories?.length) return null
    return status.summaryCategories.slice(0, 3)
  }, [status])

  async function loadChatSessions() {
    if (!jobId || !planId) return

    setIsLoadingChats(true)
    try {
      const response = await fetch(
        `/api/plan-chat/sessions?jobId=${encodeURIComponent(jobId)}&planId=${encodeURIComponent(planId)}`
      )

      if (response.ok) {
        const data = await response.json()
        setChatSessions(data.sessions || [])
        
        // Auto-select most recent chat if available
        if (data.sessions && data.sessions.length > 0 && !selectedChatId) {
          setSelectedChatId(data.sessions[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err)
    } finally {
      setIsLoadingChats(false)
    }
  }

  async function createNewChat() {
    if (!jobId || !planId) return

    try {
      const response = await fetch('/api/plan-chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, planId }),
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedChatId(data.session.id)
        setMessages([])
        await loadChatSessions()
      }
    } catch (err) {
      console.error('Failed to create new chat:', err)
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
          // Switch to most recent chat or create new one
          const remainingChats = chatSessions.filter(c => c.id !== chatIdToDelete)
          if (remainingChats.length > 0) {
            setSelectedChatId(remainingChats[0].id)
          } else {
            setSelectedChatId(null)
            setMessages([])
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  }

  async function fetchStatus() {
    if (!jobId || !planId) return

    setIsLoading(true)
    try {
      const url = `/api/plan-chat?jobId=${encodeURIComponent(jobId)}&planId=${encodeURIComponent(planId)}${selectedChatId ? `&chatId=${encodeURIComponent(selectedChatId)}` : ''}`
      const response = await fetch(url)

      if (response.status === 401) {
        setError({
          type: 'unauthorized',
          message: 'You need to be signed in to use Plan Chat.',
        })
        setStatus(null)
        return
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load plan chat status')
      }

      const data: ChatStatusResponse = await response.json()
      setStatus(data)
      setMissingTakeoff(!data.hasTakeoff)
      setError(null)

      // Load chat history from database
      if (data.chatHistory && Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
        const dbMessages: PlanChatMessage[] = data.chatHistory.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
        }))
        setMessages(dbMessages)
      }
    } catch (err) {
      console.error('Failed to fetch Plan Chat status', err)
      setStatus(null)
      setMissingTakeoff(false)
      setError({
        type: 'request-failed',
        message: 'We could not load Plan Chat for this plan right now.',
        details: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendMessage() {
    const trimmed = input.trim()
    if (!trimmed || isSending || !canChat || isVectorizing) return

    setError(null)
    setIsSending(true)
    setIsVectorizing(true) // Start vectorization loading state
    setInput('')

    const newMessage: PlanChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, newMessage])

    // Add vectorization message
    const vectorizationMessage: PlanChatMessage = {
      id: `vectorizing-${Date.now()}`,
      role: 'assistant',
      content: 'Processing plans for AI... This may take a moment.',
    }
    setMessages((prev) => [...prev, vectorizationMessage])

    try {
      const response = await fetch('/api/plan-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          planId,
          messages: [...messages, newMessage].map(({ role, content }) => ({
            role,
            content,
          })),
          model: selectedModel,
          chatId: selectedChatId,
        }),
      })

      if (response.status === 404) {
        const payload = await response.json().catch(() => ({}))
        setMissingTakeoff(true)
        setError(null)
        const assistantMessage: PlanChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            payload?.error === 'TAKEOFF_NOT_FOUND'
              ? "I don't have takeoff or processed blueprint text for this plan yet. Run the ingestion or takeoff analysis and try again."
              : 'This plan is not ready for chat yet. Please process the plan and try again.',
        }
        setMessages((prev) => [...prev, assistantMessage])
        return
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        
        // Handle vectorization queued/in progress (202 Accepted)
        if (response.status === 202 && (payload?.error === 'VECTORIZATION_QUEUED' || payload?.error === 'VECTORIZATION_IN_PROGRESS')) {
          const queueJobId = payload.queueJobId
          const progress = payload.progress || 0
          
          // Update vectorization message with progress
          setMessages((prev) => {
            const filtered = prev.filter((msg) => !msg.id.startsWith('vectorizing-'))
            const progressMessage: PlanChatMessage = {
              id: `vectorizing-${Date.now()}`,
              role: 'assistant',
              content: progress > 0 
                ? `Processing plans for AI... ${progress}% complete. This may take a few minutes for large plans.`
                : 'Processing plans for AI... This may take a few minutes for large plans. You can close this page and come back later.',
            }
            return [...filtered, progressMessage]
          })
          
          // Poll for completion
          pollVectorizationStatus(planId, queueJobId, trimmed)
          return
        }
        
        // Handle vectorization failure
        if (response.status === 500 && payload?.error === 'VECTORIZATION_FAILED') {
          // Remove vectorization message
          setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('vectorizing-')))
          
          const errorMessage = payload.message || 'Failed to prepare the plan for chat. Please try again in a moment.'
          
          const assistantMessage: PlanChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
          }
          setMessages((prev) => [...prev, assistantMessage])
          setError({
            type: 'vectorization-failed',
            message: errorMessage,
            details: payload.vectorizationStatus 
              ? `Chunks: ${payload.vectorizationStatus.chunkCount || 0}, Embeddings: ${payload.vectorizationStatus.embeddingCount || 0}`
              : 'Unknown error',
          })
          return
        }
        
        throw new Error(payload.error || 'Failed to get a response from Plan Chat')
      }

      const payload: { reply?: string; chatId?: string; metadata?: { wasVectorizing?: boolean }; error?: string } = await response.json()
      
      // Validate that reply exists and is a non-empty string
      if (!payload || !payload.reply || typeof payload.reply !== 'string' || payload.reply.trim().length === 0) {
        const errorMessage = payload?.error || 'The AI returned an empty or invalid response. Please try again.'
        console.error('[PlanChat] Invalid response payload:', {
          hasPayload: !!payload,
          hasReply: !!payload?.reply,
          replyType: payload?.reply ? typeof payload.reply : 'undefined',
          replyLength: payload?.reply?.length || 0,
          error: payload?.error,
        })
        throw new Error(errorMessage)
      }
      
      // Remove vectorization message and add the actual response
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.id.startsWith('vectorizing-'))
        return filtered
      })
      
      // Update selected chat ID if a new one was created
      if (payload.chatId && payload.chatId !== selectedChatId) {
        setSelectedChatId(payload.chatId)
        await loadChatSessions()
      }
      
      const assistantMessage: PlanChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: (payload.reply || '').trim(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      
      // Refresh chat sessions after a short delay to pick up AI-generated title
      // Title generation happens async, so wait a bit before refreshing
      setTimeout(() => {
        loadChatSessions()
      }, 2000)
    } catch (err) {
      console.error('Plan Chat request failed', err)
      // Remove vectorization message on error
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.id.startsWith('vectorizing-'))
        return filtered.filter((message) => message.id !== newMessage.id)
      })
      setInput(trimmed)
      setError({
        type: 'request-failed',
        message: 'Plan Chat ran into an issue. Try again in a moment.',
        details: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsSending(false)
      setIsVectorizing(false)
    }
  }

  // Poll for vectorization status
  async function pollVectorizationStatus(planId: string, queueJobId: string, originalMessage: string, maxAttempts = 60) {
    let attempts = 0
    const pollInterval = 3000 // Poll every 3 seconds

    const poll = async () => {
      if (attempts >= maxAttempts) {
        // Timeout after 3 minutes
        setMessages((prev) => {
          const filtered = prev.filter((msg) => !msg.id.startsWith('vectorizing-'))
          const timeoutMessage: PlanChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: 'Vectorization is taking longer than expected. Please try again in a few minutes.',
          }
          return [...filtered, timeoutMessage]
        })
        setIsVectorizing(false)
        setVectorizationProgress(null)
        return
      }

      attempts++

      try {
        const response = await fetch(`/api/plan-vectorization/queue?planId=${planId}&jobId=${jobId}`)
        if (response.ok) {
          const job = await response.json()
          
          setVectorizationProgress(job.progress || 0)
          
          // Update progress message
          setMessages((prev) => {
            const filtered = prev.filter((msg) => !msg.id.startsWith('vectorizing-'))
            const progressMessage: PlanChatMessage = {
              id: `vectorizing-${Date.now()}`,
              role: 'assistant',
              content: job.status === 'completed'
                ? 'Vectorization complete! Processing your question...'
                : `Processing plans for AI... ${job.progress || 0}% complete${job.current_step ? ` (${job.current_step})` : ''}. This may take a few minutes for large plans.`,
            }
            return [...filtered, progressMessage]
          })

          if (job.status === 'completed') {
            setIsVectorizing(false)
            setVectorizationProgress(null)
            // Remove vectorization message and retry the original request
            setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('vectorizing-')))
            
            // Retry the chat request with the original message
            setTimeout(async () => {
              try {
                const retryResponse = await fetch('/api/plan-chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jobId,
                    planId,
                    messages: [{ role: 'user', content: originalMessage }],
                    model: selectedModel,
                    chatId: selectedChatId,
                  }),
                })

                if (retryResponse.ok) {
                  const retryPayload: { reply?: string; chatId?: string } = await retryResponse.json()
                  
                  // Validate that reply exists and is a non-empty string
                  if (!retryPayload || !retryPayload.reply || typeof retryPayload.reply !== 'string' || retryPayload.reply.trim().length === 0) {
                    throw new Error('Invalid response: missing or invalid reply')
                  }
                  
                  const assistantMessage: PlanChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: (retryPayload.reply || '').trim(),
                  }
                  setMessages((prev) => [...prev, assistantMessage])
                } else {
                  throw new Error('Failed to get response after vectorization')
                }
              } catch (retryError) {
                console.error('Error retrying after vectorization:', retryError)
                const errorMessage: PlanChatMessage = {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: 'Vectorization completed, but there was an error processing your question. Please try again.',
                }
                setMessages((prev) => [...prev, errorMessage])
              } finally {
                setIsSending(false)
              }
            }, 1000)
            return
          }

          if (job.status === 'failed') {
            setMessages((prev) => {
              const filtered = prev.filter((msg) => !msg.id.startsWith('vectorizing-'))
              const errorMessage: PlanChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: job.error_message || 'Vectorization failed. Please try again.',
              }
              return [...filtered, errorMessage]
            })
            setIsVectorizing(false)
            setVectorizationProgress(null)
            return
          }

          // Continue polling
          setTimeout(poll, pollInterval)
        } else {
          // Error polling, continue anyway
          setTimeout(poll, pollInterval)
        }
      } catch (error) {
        console.error('Error polling vectorization status:', error)
        // Continue polling on error
        setTimeout(poll, pollInterval)
      }
    }

    // Start polling
    setTimeout(poll, pollInterval)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-4 w-4 text-orange-500" />
              <h4 className="text-sm font-semibold text-gray-900">Plan Chat</h4>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
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
            <p className="mt-1 text-xs text-gray-500">
              Ask questions about this plan. Answers combine the latest takeoff data with text snippets
              extracted from the blueprint.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={isLoading || isSending}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-0">
              {isLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500 py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">Preparing Plan Chat…</span>
                </div>
              ) : isVectorizing ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-600 py-12 px-4">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Processing plans for AI...</p>
                    <p className="mt-1 text-xs text-gray-500">Extracting and vectorizing blueprint text. This may take a moment.</p>
                  </div>
                </div>
              ) : !canChat ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-600 py-12 px-4">
                  <TriangleAlert className="h-8 w-8 text-amber-500" />
                  <p className="max-w-xs text-sm font-medium">
                    {error?.message || 'Plan Chat is temporarily unavailable. Try again in a moment.'}
                  </p>
                  {error?.details && (
                    <p className="max-w-sm text-xs text-gray-400">{error.details}</p>
                  )}
                </div>
              ) : hasActiveConversation ? (
                <>
                  {missingTakeoff && (
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                      <div className="mx-auto max-w-3xl">
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                          Takeoff results for this plan are still processing. I&rsquo;ll answer using the
                          blueprint text snippets that have been ingested so far.
                        </div>
                      </div>
                    </div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`group py-6 px-4 hover:bg-gray-50/50 transition-colors ${
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
                              {message.role === 'user' ? 'You' : 'AI Estimator'}
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
                              <UserIcon className="h-5 w-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <AnimatePresence>
                    {isSending && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="py-6 px-4 bg-white"
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="px-4 py-8">
                  <div className="mx-auto max-w-2xl space-y-4">
                    {missingTakeoff && (
                      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
                        Takeoff results aren&rsquo;t ready yet, but you can still ask about sheet notes,
                        legends, and other text pulled from the blueprint. I&rsquo;ll let you know when I
                        need more data.
                      </div>
                    )}
                    <div className="text-center mb-8">
                      <Bot className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        How can I help you today?
                      </h3>
                      <p className="text-sm text-gray-500">
                        Ask about quantities, categories, or anything captured in the takeoff. When takeoff
                        data is missing, I&rsquo;ll rely on the blueprint text that has been processed and
                        tell you if something isn&rsquo;t available yet.
                      </p>
                    </div>
                    {summaryPreview && summaryPreview.length > 0 && (
                      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                          Category Highlights
                        </p>
                        <ul className="space-y-2 text-sm text-gray-700">
                          {summaryPreview.map((category) => (
                            <li key={category.category} className="flex items-center justify-between">
                              <span>{category.category}</span>
                              <span className="text-gray-500 font-medium">
                                {category.totalQuantity.toLocaleString()}
                                {category.unit ? ` ${category.unit}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="space-y-3">
                      <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
                        <MessageCircleQuestion className="h-4 w-4" />
                        Try asking
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {examplePrompts.map((prompt) => (
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
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white">
            <div className="px-4 py-3">
              <div className="relative flex items-end gap-3 rounded-2xl border border-gray-300 bg-white shadow-sm hover:border-gray-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                <Textarea
                  placeholder={
                    canChat
                    ? 'Ask a question about this plan…'
                    : 'Plan Chat is currently unavailable.'
                  }
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={!canChat || isSending}
                  rows={1}
                  className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-2.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = `${Math.min(target.scrollHeight, 200)}px`
                  }}
                />
                <div className="flex-shrink-0 pb-1.5 pr-2">
                  <Button
                    onClick={handleSendMessage}
                    disabled={!canChat || !input.trim() || isSending || isVectorizing}
                    className="h-8 w-8 rounded-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
                    size="icon"
                  >
                    {isSending || isVectorizing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    ) : (
                      <Send className="h-3.5 w-3.5 text-white" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isSending}>
                  <SelectTrigger className="h-6 w-auto border-0 bg-transparent text-xs text-gray-500 hover:text-gray-700 px-0">
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
      </div>
    </div>
  )
}

export default PlanChatPanel


