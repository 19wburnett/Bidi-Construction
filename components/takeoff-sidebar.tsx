'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  MessageSquare,
  Send,
  DollarSign,
  Calculator,
  Download,
  FileText,
  Clock,
  Bot,
  User as UserIcon,
  TrendingUp,
  Filter,
  Search
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface TakeoffItem {
  id: string
  item_type: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  location_reference: string | null
  confidence_score: number | null
  notes: string | null
  detected_by: 'ai' | 'manual' | 'imported'
  tags: string[] | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

interface TakeoffSidebarProps {
  takeoffId: string
  items: TakeoffItem[]
  onItemsChange: (items: TakeoffItem[]) => void
  onItemSelect?: (itemId: string) => void
  readOnly?: boolean
}

const CATEGORIES = [
  'Structural',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Finishes',
  'Concrete',
  'Doors & Windows',
  'Other'
]

const UNITS = [
  'units',
  'sq ft',
  'linear ft',
  'cu yd',
  'cu ft',
  'each',
  'lot',
  'ton'
]

export default function TakeoffSidebar({
  takeoffId,
  items,
  onItemsChange,
  onItemSelect,
  readOnly = false
}: TakeoffSidebarProps) {
  const [activeTab, setActiveTab] = useState<'items' | 'chat'>('items')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<TakeoffItem>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingChat, setIsLoadingChat] = useState(false)
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Calculate totals
  const totalCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0)
  const itemsByCategory = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_type.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  // Load chat history
  useEffect(() => {
    loadChatHistory()
  }, [takeoffId])

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`takeoff_items:${takeoffId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'takeoff_items',
          filter: `takeoff_id=eq.${takeoffId}`
        },
        (payload) => {
          // Refresh items when changes occur
          console.log('Items updated:', payload)
          // In production, you'd fetch updated items here
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [takeoffId])

  async function loadChatHistory() {
    setIsLoadingChat(true)
    try {
      const response = await fetch(`/api/takeoff/chat?takeoffId=${takeoffId}`)
      const data = await response.json()
      
      if (data.success) {
        setChatMessages(data.messages)
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    } finally {
      setIsLoadingChat(false)
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim() || isSending) return

    setIsSending(true)
    const userMessage = chatInput.trim()
    setChatInput('')

    // Add user message optimistically
    const tempUserMessage: ChatMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await fetch('/api/takeoff/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          takeoffId,
          message: userMessage,
          includeHistory: true
        })
      })

      const data = await response.json()

      if (data.success) {
        // Add AI response
        const aiMessage: ChatMessage = {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(data.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      setChatMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
      alert('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  function startEditing(item: TakeoffItem) {
    setEditingItem(item.id)
    setEditForm(item)
  }

  function cancelEditing() {
    setEditingItem(null)
    setEditForm({})
  }

  async function saveItem() {
    if (!editingItem || readOnly) return

    try {
      const { error } = await supabase
        .from('takeoff_items')
        .update({
          item_type: editForm.item_type,
          category: editForm.category,
          description: editForm.description,
          quantity: editForm.quantity,
          unit: editForm.unit,
          unit_cost: editForm.unit_cost,
          location_reference: editForm.location_reference,
          notes: editForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem)

      if (error) throw error

      // Update local state
      const updatedItems = items.map(item =>
        item.id === editingItem
          ? { ...item, ...editForm, total_cost: (editForm.quantity || 0) * (editForm.unit_cost || 0) }
          : item
      )
      onItemsChange(updatedItems)
      
      cancelEditing()
    } catch (error) {
      console.error('Error saving item:', error)
      alert('Failed to save item')
    }
  }

  async function deleteItem(itemId: string) {
    if (readOnly || !confirm('Are you sure you want to delete this item?')) return

    try {
      const { error } = await supabase
        .from('takeoff_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      onItemsChange(items.filter(item => item.id !== itemId))
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    }
  }

  async function addNewItem() {
    if (readOnly) return

    const newItem: Partial<TakeoffItem> = {
      item_type: 'new_item',
      category: 'Other',
      description: 'New item',
      quantity: 0,
      unit: 'units',
      unit_cost: 0,
      detected_by: 'manual'
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('takeoff_items')
        .insert({
          takeoff_id: takeoffId,
          ...newItem,
          created_by: user?.id,
          updated_by: user?.id
        })
        .select()
        .single()

      if (error) throw error

      onItemsChange([...items, data])
      startEditing(data.id)
    } catch (error) {
      console.error('Error adding item:', error)
      alert('Failed to add item')
    }
  }

  async function exportToCSV() {
    const headers = ['Category', 'Type', 'Description', 'Quantity', 'Unit', 'Unit Cost', 'Total Cost', 'Location', 'Notes']
    const rows = items.map(item => [
      item.category,
      item.item_type,
      item.description,
      item.quantity,
      item.unit,
      item.unit_cost,
      item.total_cost,
      item.location_reference || '',
      item.notes || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `takeoff-${takeoffId}-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Takeoff Details</h2>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2">
          <Button
            variant={activeTab === 'items' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('items')}
            className="flex-1"
          >
            <Table className="h-4 w-4 mr-2" />
            Items ({items.length})
          </Button>
          <Button
            variant={activeTab === 'chat' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('chat')}
            className="flex-1"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            AI Chat
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'items' ? (
          <div className="h-full flex flex-col">
            {/* Summary */}
            <div className="p-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${totalCost.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(itemsByCategory).map(([cat, count]) => (
                  <Badge key={cat} variant="secondary">
                    {cat}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {filteredItems.map(item => (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-all ${
                    editingItem === item.id ? 'ring-2 ring-orange-500' : 'hover:shadow-md'
                  }`}
                  onClick={() => onItemSelect?.(item.id)}
                >
                  <CardContent className="p-4">
                    {editingItem === item.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={editForm.category}
                              onValueChange={(val) => setEditForm({ ...editForm, category: val })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Type</Label>
                            <Input
                              value={editForm.item_type}
                              onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit</Label>
                            <Select
                              value={editForm.unit}
                              onValueChange={(val) => setEditForm({ ...editForm, unit: val })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS.map(unit => (
                                  <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Unit Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.unit_cost}
                              onChange={(e) => setEditForm({ ...editForm, unit_cost: parseFloat(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Location</Label>
                          <Input
                            value={editForm.location_reference || ''}
                            onChange={(e) => setEditForm({ ...editForm, location_reference: e.target.value })}
                            placeholder="e.g., Floor 1, Room A"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Notes</Label>
                          <Textarea
                            value={editForm.notes || ''}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            rows={2}
                          />
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm" onClick={cancelEditing}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button variant="default" size="sm" onClick={saveItem}>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                              {item.detected_by === 'ai' && (
                                <Badge variant="outline" className="text-xs">
                                  AI
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-sm">{item.description}</h4>
                            {item.location_reference && (
                              <p className="text-xs text-gray-500 mt-1">
                                📍 {item.location_reference}
                              </p>
                            )}
                          </div>
                          {!readOnly && (
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditing(item)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteItem(item.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Quantity</p>
                            <p className="font-semibold">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Unit Cost</p>
                            <p className="font-semibold">${item.unit_cost.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-semibold text-green-600">
                              ${item.total_cost.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {item.notes && (
                          <p className="text-xs text-gray-600 mt-2 italic">{item.notes}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No items found</p>
                </div>
              )}
            </div>

            {/* Add Button */}
            {!readOnly && (
              <div className="p-4 border-t">
                <Button onClick={addNewItem} className="w-full" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Chat Tab
          <div className="h-full flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {isLoadingChat ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="mb-4">Ask AI about your takeoff</p>
                  <div className="space-y-2 text-left max-w-sm mx-auto text-sm">
                    <p className="text-xs text-gray-400">Example questions:</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setChatInput("How many square feet of drywall are in this takeoff?")}
                    >
                      "How many square feet of drywall?"
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setChatInput("What's the total cost for electrical work?")}
                    >
                      "Total cost for electrical work?"
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setChatInput("Am I missing any common materials?")}
                    >
                      "Am I missing any materials?"
                    </Button>
                  </div>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        {message.role === 'user' ? (
                          <UserIcon className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                        <span className="text-xs opacity-75">
                          {message.role === 'user' ? 'You' : 'AI Assistant'}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Ask about quantities, costs, or materials..."
                  rows={2}
                  disabled={isSending}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isSending}
                  className="self-end"
                >
                  {isSending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


