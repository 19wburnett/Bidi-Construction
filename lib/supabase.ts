import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'GC' | 'sub' | 'admin'
          stripe_customer_id: string | null
          is_admin: boolean
          demo_mode: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'GC' | 'sub' | 'admin'
          stripe_customer_id?: string | null
          is_admin?: boolean
          demo_mode?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'GC' | 'sub' | 'admin'
          stripe_customer_id?: string | null
          is_admin?: boolean
          demo_mode?: boolean
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
          plan_files: string[] | null
          status: 'active' | 'closed' | 'cancelled' | 'expired'
          bid_collection_started_at: string | null
          bid_collection_ends_at: string | null
          recipient_type: 'contacts_only' | 'network_only' | 'both' | 'selected'
          selected_network_subcontractors: string[] | null
          selected_contact_subcontractors: string[] | null
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
          plan_files?: string[] | null
          status?: 'active' | 'closed' | 'collecting_bids'
          bid_collection_started_at?: string | null
          bid_collection_ends_at?: string | null
          recipient_type?: 'contacts_only' | 'network_only' | 'both' | 'selected'
          selected_network_subcontractors?: string[] | null
          selected_contact_subcontractors?: string[] | null
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
          plan_files?: string[] | null
          status?: 'active' | 'closed' | 'collecting_bids'
          bid_collection_started_at?: string | null
          bid_collection_ends_at?: string | null
          recipient_type?: 'contacts_only' | 'network_only' | 'both' | 'selected'
          selected_network_subcontractors?: string[] | null
          selected_contact_subcontractors?: string[] | null
          created_at?: string
        }
      }
      plan_annotations: {
        Row: {
          id: string
          job_request_id: string
          plan_file_url: string
          bid_id: string | null
          annotation_type: 'note' | 'question' | 'concern' | 'suggestion' | 'highlight'
          x_coordinate: number
          y_coordinate: number
          content: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          job_request_id: string
          plan_file_url: string
          bid_id?: string | null
          annotation_type: 'note' | 'question' | 'concern' | 'suggestion' | 'highlight'
          x_coordinate: number
          y_coordinate: number
          content: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          job_request_id?: string
          plan_file_url?: string
          bid_id?: string | null
          annotation_type?: 'note' | 'question' | 'concern' | 'suggestion' | 'highlight'
          x_coordinate?: number
          y_coordinate?: number
          content?: string
          created_at?: string
          created_by?: string | null
        }
      }
      plan_annotation_responses: {
        Row: {
          id: string
          annotation_id: string
          content: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          annotation_id: string
          content: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          annotation_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
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
      bid_notes: {
        Row: {
          id: string
          bid_id: string
          note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
          category: string | null
          location: string | null
          content: string
          confidence_score: number
          created_at: string
          page_number: number | null
        }
        Insert: {
          id?: string
          bid_id: string
          note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
          category?: string | null
          location?: string | null
          content: string
          confidence_score?: number
          created_at?: string
          page_number?: number | null
        }
        Update: {
          id?: string
          bid_id?: string
          note_type?: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
          category?: string | null
          location?: string | null
          content?: string
          confidence_score?: number
          created_at?: string
          page_number?: number | null
        }
      }
      gc_contacts: {
        Row: {
          id: string
          gc_id: string
          email: string
          name: string
          company: string | null
          phone: string | null
          trade_category: string
          location: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gc_id: string
          email: string
          name: string
          company?: string | null
          phone?: string | null
          trade_category: string
          location: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gc_id?: string
          email?: string
          name?: string
          company?: string | null
          phone?: string | null
          trade_category?: string
          location?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
