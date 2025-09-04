import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const createClient = () => {
  return createClientComponentClient()
}

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'GC' | 'sub'
          stripe_customer_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'GC' | 'sub'
          stripe_customer_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'GC' | 'sub'
          stripe_customer_id?: string | null
          created_at?: string
        }
      }
      job_requests: {
        Row: {
          id: string
          gc_id: string
          trade_category: string
          location: string
          description: string
          budget_range: string
          files: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          gc_id: string
          trade_category: string
          location: string
          description: string
          budget_range: string
          files?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          gc_id?: string
          trade_category?: string
          location?: string
          description?: string
          budget_range?: string
          files?: string[] | null
          created_at?: string
        }
      }
      bids: {
        Row: {
          id: string
          job_request_id: string
          subcontractor_email: string
          subcontractor_name: string | null
          phone: string | null
          bid_amount: number | null
          timeline: string | null
          notes: string | null
          ai_summary: string | null
          raw_email: string
          created_at: string
        }
        Insert: {
          id?: string
          job_request_id: string
          subcontractor_email: string
          subcontractor_name?: string | null
          phone?: string | null
          bid_amount?: number | null
          timeline?: string | null
          notes?: string | null
          ai_summary?: string | null
          raw_email: string
          created_at?: string
        }
        Update: {
          id?: string
          job_request_id?: string
          subcontractor_email?: string
          subcontractor_name?: string | null
          phone?: string | null
          bid_amount?: number | null
          timeline?: string | null
          notes?: string | null
          ai_summary?: string | null
          raw_email?: string
          created_at?: string
        }
      }
      subcontractors: {
        Row: {
          id: string
          email: string
          name: string
          trade_category: string
          location: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          trade_category: string
          location: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          trade_category?: string
          location?: string
          created_at?: string
        }
      }
    }
  }
}
