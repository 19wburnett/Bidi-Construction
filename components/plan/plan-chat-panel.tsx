'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  Loader2,
  MessageCircleQuestion,
  Send,
  TriangleAlert,
  User as UserIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
}

interface ChatErrorState {
  type: 'missing-takeoff' | 'request-failed' | 'unauthorized' | 'unknown'
  message: string
  details?: string
}

const examplePrompts = [
  'How many linear feet of interior walls are measured on this plan?',
  'What are the top three categories by total quantity?',
  'List all items related to doors and windows with their counts.',
  'Summarize the flooring quantities by level.'
]

export function PlanChatPanel({ jobId, planId }: PlanChatPanelProps) {
  const [messages, setMessages] = useState<PlanChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<ChatStatusResponse | null>(null)
  const [error, setError] = useState<ChatErrorState | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const hasActiveConversation = messages.length > 0
  const canChat = status?.hasTakeoff && !error

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    setMessages([])
    setInput('')
    setStatus(null)
    setError(null)
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, planId])

  const summaryPreview = useMemo(() => {
    if (!status?.summaryCategories?.length) return null
    return status.summaryCategories.slice(0, 3)
  }, [status])

  async function fetchStatus() {
    if (!jobId || !planId) return

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/plan-chat?jobId=${encodeURIComponent(jobId)}&planId=${encodeURIComponent(planId)}`
      )

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

      if (!data.hasTakeoff) {
        setError({
          type: 'missing-takeoff',
          message: 'Plan Chat is available after a takeoff has been generated for this plan.',
        })
      } else {
        setError(null)
      }
    } catch (err) {
      console.error('Failed to fetch Plan Chat status', err)
      setStatus(null)
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
    if (!trimmed || isSending || !canChat) return

    setError(null)
    setIsSending(true)
    setInput('')

    const newMessage: PlanChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, newMessage])

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
        }),
      })

      if (response.status === 404) {
        const payload = await response.json().catch(() => ({}))
        setError({
          type: 'missing-takeoff',
          message:
            payload?.error === 'TAKEOFF_NOT_FOUND'
              ? 'We could not find takeoff data for this plan yet.'
              : 'This plan does not have takeoff data yet.',
        })
        return
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to get a response from Plan Chat')
      }

      const payload: { reply: string } = await response.json()
      const assistantMessage: PlanChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: payload.reply.trim(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Plan Chat request failed', err)
      setError({
        type: 'request-failed',
        message: 'Plan Chat ran into an issue. Try again in a moment.',
        details: err instanceof Error ? err.message : String(err),
      })
      setMessages((prev) => prev.filter((message) => message.id !== newMessage.id))
      setInput(trimmed)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-gray-900">Plan Chat</h4>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Ask questions about the takeoff for this plan. Answers use the latest takeoff data only.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={isLoading || isSending}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        <div className="flex h-[320px] flex-col justify-between">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Preparing Plan Chat…</span>
              </div>
            ) : !canChat ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-600">
                <TriangleAlert className="h-8 w-8 text-amber-500" />
                <p className="max-w-xs text-sm font-medium">
                  {error?.message ||
                    'Plan Chat is available once a takeoff has been generated for this plan.'}
                </p>
                {error?.details && (
                  <p className="max-w-sm text-xs text-gray-400">{error.details}</p>
                )}
              </div>
            ) : hasActiveConversation ? (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-1 text-xs opacity-75">
                        {message.role === 'user' ? (
                          <UserIcon className="h-3.5 w-3.5" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )}
                        <span>{message.role === 'user' ? 'You' : 'AI Estimator'}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}
                <AnimatePresence>
                  {isSending && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex justify-start"
                    >
                      <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Thinking…
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  <p className="mb-2 font-medium text-gray-700">
                    Ready to help with takeoff insights for this plan.
                  </p>
                  <p>
                    Ask about quantities, categories, or anything captured in the takeoff. The AI
                    only uses the takeoff data for this plan and will let you know if something
                    isn’t available.
                  </p>
                </div>
                {summaryPreview && summaryPreview.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Category Highlights
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-700">
                      {summaryPreview.map((category) => (
                        <li key={category.category} className="flex items-center justify-between">
                          <span>{category.category}</span>
                          <span className="text-gray-500">
                            {category.totalQuantity.toLocaleString()}
                            {category.unit ? ` ${category.unit}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <MessageCircleQuestion className="h-3.5 w-3.5" />
                    Try asking
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {examplePrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        className="justify-start text-left text-xs"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-gray-200 bg-white px-4 py-3">
            <Textarea
              placeholder={
                canChat
                  ? 'Ask a question about this takeoff…'
                  : 'Plan Chat is unavailable until the takeoff is ready.'
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
              rows={3}
              className="resize-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Press Enter to send · Shift+Enter for a new line
              </p>
              <Button
                onClick={handleSendMessage}
                disabled={!canChat || !input.trim() || isSending}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlanChatPanel


