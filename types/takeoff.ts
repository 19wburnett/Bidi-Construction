// Type definitions for the AI Takeoff System

export type TakeoffStatus = 'draft' | 'active' | 'archived'
export type AIAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DetectionSource = 'ai' | 'manual' | 'imported'
export type CommentType = 'general' | 'question' | 'suggestion' | 'issue'
export type ChatRole = 'user' | 'assistant' | 'system'

// Job-centric types
export type JobStatus = 'draft' | 'active' | 'completed' | 'archived'
export type BidPackageStatus = 'draft' | 'sent' | 'receiving' | 'closed'
export type SharePermissions = 'view_only' | 'markup' | 'comment' | 'all'

export interface Job {
  id: string
  user_id: string
  name: string
  description: string | null
  location: string
  budget_range: string | null
  project_type: string | null
  status: JobStatus
  created_at: string
  updated_at: string
}

export interface BidPackage {
  id: string
  job_id: string
  trade_category: string
  description: string | null
  minimum_line_items: any[] // JSONB array from takeoff
  status: BidPackageStatus
  sent_at: string | null
  deadline: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface PlanShare {
  id: string
  plan_id: string
  share_token: string
  created_by: string
  permissions: SharePermissions
  expires_at: string | null
  accessed_count: number
  last_accessed_at: string | null
  created_at: string
}

export interface Plan {
  id: string
  title: string | null
  file_name: string
  file_path: string
  status: string
  num_pages: number
  project_name: string | null
  project_location: string | null
  takeoff_analysis_status?: string | null
  takeoff_requested_at?: string | null
  quality_analysis_status?: string | null
  quality_requested_at?: string | null
  job_id?: string | null // New field linking to jobs
}

export interface Takeoff {
  id: string
  project_id: string
  user_id: string
  plan_file_url: string
  name: string
  version: number
  status: TakeoffStatus
  data: any
  ai_analysis_status: AIAnalysisStatus
  ai_analysis_result: AIAnalysisResult | null
  ai_confidence_score: number | null
  last_edited_by: string | null
  is_locked: boolean
  locked_by: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

export interface AIAnalysisResult {
  raw_response?: string
  items_count: number
  analyzed_at: string
  error?: string
  failed_at?: string
}

export interface TakeoffItem {
  id: string
  takeoff_id: string
  item_type: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  location_reference: string | null
  detected_by: DetectionSource
  confidence_score: number | null
  detection_coordinates: DetectionCoordinates | null
  plan_page_number: number | null
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface DetectionCoordinates {
  x: number // Normalized 0-1
  y: number // Normalized 0-1
  width: number // Normalized 0-1
  height: number // Normalized 0-1
  page?: number
}

export interface TakeoffItemInput {
  item_type: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number
  location_reference?: string | null
  detected_by?: DetectionSource
  confidence_score?: number | null
  detection_coordinates?: DetectionCoordinates | null
  plan_page_number?: number | null
  notes?: string | null
  tags?: string[] | null
}

export interface TakeoffComment {
  id: string
  takeoff_id: string
  takeoff_item_id: string | null
  content: string
  comment_type: CommentType
  parent_comment_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  is_resolved: boolean
}

export interface TakeoffPresence {
  id: string
  takeoff_id: string
  user_id: string
  user_email?: string
  last_seen_at: string
  current_view: string | null
  cursor_position: CursorPosition | null
}

export interface CursorPosition {
  page?: number
  scale?: number
  rotation?: number
  x?: number
  y?: number
}

export interface TakeoffVersion {
  id: string
  takeoff_id: string
  version_number: number
  name: string | null
  description: string | null
  data_snapshot: any
  items_snapshot: any
  created_by: string
  created_at: string
}

export interface CostTemplate {
  id: string
  user_id: string | null
  is_global: boolean
  name: string
  trade_category: string
  description: string | null
  template_data: CostTemplateItem[]
  created_at: string
  updated_at: string
}

export interface CostTemplateItem {
  item_type: string
  unit: string
  unit_cost: number
  notes?: string
}

export interface TakeoffChatMessage {
  id: string
  takeoff_id: string
  user_id: string
  role: ChatRole
  content: string
  references_items: string[] | null
  created_at: string
}

// API Request/Response types

export interface CreateTakeoffRequest {
  projectId: string
  planFileUrl: string
  name: string
  autoAnalyze?: boolean
}

export interface CreateTakeoffResponse {
  success: boolean
  takeoff: Takeoff
  error?: string
}

export interface AnalyzePlanRequest {
  planFileUrl: string
  projectId: string
  takeoffId?: string
}

export interface AnalyzePlanResponse {
  success: boolean
  items: TakeoffItemInput[]
  metadata: {
    total_items: number
    confidence_score: number
    categories: string[]
  }
  error?: string
  details?: string
}

export interface ChatRequest {
  takeoffId: string
  message: string
  includeHistory?: boolean
}

export interface ChatResponse {
  success: boolean
  message: string
  context: {
    items_referenced: number
    categories: string[]
  }
  error?: string
}

export interface ListTakeoffsResponse {
  success: boolean
  takeoffs: (Takeoff & { takeoff_items?: { count: number }[] })[]
  error?: string
}

// Component Props types

export interface TakeoffViewerProps {
  planFileUrl: string
  takeoffId: string
  items: TakeoffItem[]
  onItemClick?: (item: TakeoffItem) => void
  readOnly?: boolean
}

export interface TakeoffSidebarProps {
  takeoffId: string
  items: TakeoffItem[]
  onItemsChange: (items: TakeoffItem[]) => void
  onItemSelect?: (itemId: string) => void
  readOnly?: boolean
}

// Utility types

export interface TakeoffSummary {
  total_items: number
  total_cost: number
  items_by_category: Record<string, TakeoffItem[]>
  ai_detected_count: number
  manual_count: number
  categories: string[]
}

export interface CategorySummary {
  category: string
  item_count: number
  total_cost: number
  total_quantity: number
  items: TakeoffItem[]
}

// Constants

export const TAKEOFF_CATEGORIES = [
  'Structural',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Finishes',
  'Concrete',
  'Doors & Windows',
  'Other'
] as const

export const TAKEOFF_UNITS = [
  'units',
  'sq ft',
  'linear ft',
  'cu yd',
  'cu ft',
  'each',
  'lot',
  'ton',
  'lbs',
  'gallons'
] as const

export type TakeoffCategory = typeof TAKEOFF_CATEGORIES[number]
export type TakeoffUnit = typeof TAKEOFF_UNITS[number]

// Utility functions

export function calculateTakeoffSummary(items: TakeoffItem[]): TakeoffSummary {
  const items_by_category = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, TakeoffItem[]>)

  return {
    total_items: items.length,
    total_cost: items.reduce((sum, item) => sum + item.total_cost, 0),
    items_by_category,
    ai_detected_count: items.filter(i => i.detected_by === 'ai').length,
    manual_count: items.filter(i => i.detected_by === 'manual').length,
    categories: Object.keys(items_by_category)
  }
}

export function getCategorySummaries(items: TakeoffItem[]): CategorySummary[] {
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, TakeoffItem[]>)

  return Object.entries(grouped).map(([category, categoryItems]) => ({
    category,
    item_count: categoryItems.length,
    total_cost: categoryItems.reduce((sum, item) => sum + item.total_cost, 0),
    total_quantity: categoryItems.reduce((sum, item) => sum + item.quantity, 0),
    items: categoryItems
  }))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function formatQuantity(quantity: number, unit: string): string {
  const formatted = quantity.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
  return `${formatted} ${unit}`
}

export function getConfidenceColor(score: number | null): string {
  if (!score) return 'gray'
  if (score >= 0.9) return 'green'
  if (score >= 0.7) return 'blue'
  if (score >= 0.5) return 'yellow'
  return 'red'
}

export function getConfidenceLabel(score: number | null): string {
  if (!score) return 'Unknown'
  if (score >= 0.9) return 'Very High'
  if (score >= 0.7) return 'High'
  if (score >= 0.5) return 'Moderate'
  return 'Low'
}


