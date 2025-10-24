import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey
    })
    throw new Error('Missing Supabase environment variables')
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
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
      guest_users: {
        Row: {
          id: string
          session_token: string
          guest_name: string
          email: string | null
          created_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          session_token: string
          guest_name: string
          email?: string | null
          created_at?: string
          last_seen_at?: string
        }
        Update: {
          id?: string
          session_token?: string
          guest_name?: string
          email?: string | null
          created_at?: string
          last_seen_at?: string
        }
      }
      plan_shares: {
        Row: {
          id: string
          plan_id: string
          share_token: string
          created_by: string
          created_at: string
          expires_at: string | null
          allow_comments: boolean
          allow_drawings: boolean
          is_active: boolean
          access_count: number
          last_accessed_at: string | null
        }
        Insert: {
          id?: string
          plan_id: string
          share_token?: string
          created_by: string
          created_at?: string
          expires_at?: string | null
          allow_comments?: boolean
          allow_drawings?: boolean
          is_active?: boolean
          access_count?: number
          last_accessed_at?: string | null
        }
        Update: {
          id?: string
          plan_id?: string
          share_token?: string
          created_by?: string
          created_at?: string
          expires_at?: string | null
          allow_comments?: boolean
          allow_drawings?: boolean
          is_active?: boolean
          access_count?: number
          last_accessed_at?: string | null
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
          guest_user_id: string | null
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
          guest_user_id?: string | null
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
          guest_user_id?: string | null
        }
      }
      plan_annotation_responses: {
        Row: {
          id: string
          annotation_id: string
          content: string
          created_at: string
          created_by: string | null
          guest_user_id: string | null
        }
        Insert: {
          id?: string
          annotation_id: string
          content: string
          created_at?: string
          created_by?: string | null
          guest_user_id?: string | null
        }
        Update: {
          id?: string
          annotation_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          guest_user_id?: string | null
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
      takeoffs: {
        Row: {
          id: string
          project_id: string
          user_id: string
          plan_file_url: string
          name: string
          version: number
          status: 'draft' | 'active' | 'archived'
          data: any
          ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed'
          ai_analysis_result: any | null
          ai_confidence_score: number | null
          last_edited_by: string | null
          is_locked: boolean
          locked_by: string | null
          locked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          plan_file_url: string
          name: string
          version?: number
          status?: 'draft' | 'active' | 'archived'
          data?: any
          ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed'
          ai_analysis_result?: any | null
          ai_confidence_score?: number | null
          last_edited_by?: string | null
          is_locked?: boolean
          locked_by?: string | null
          locked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          plan_file_url?: string
          name?: string
          version?: number
          status?: 'draft' | 'active' | 'archived'
          data?: any
          ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed'
          ai_analysis_result?: any | null
          ai_confidence_score?: number | null
          last_edited_by?: string | null
          is_locked?: boolean
          locked_by?: string | null
          locked_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      takeoff_items: {
        Row: {
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
          detected_by: 'ai' | 'manual' | 'imported'
          confidence_score: number | null
          detection_coordinates: any | null
          plan_page_number: number | null
          notes: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          takeoff_id: string
          item_type: string
          category: string
          description: string
          quantity?: number
          unit: string
          unit_cost?: number
          location_reference?: string | null
          detected_by?: 'ai' | 'manual' | 'imported'
          confidence_score?: number | null
          detection_coordinates?: any | null
          plan_page_number?: number | null
          notes?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          takeoff_id?: string
          item_type?: string
          category?: string
          description?: string
          quantity?: number
          unit?: string
          unit_cost?: number
          location_reference?: string | null
          detected_by?: 'ai' | 'manual' | 'imported'
          confidence_score?: number | null
          detection_coordinates?: any | null
          plan_page_number?: number | null
          notes?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
      }
      takeoff_comments: {
        Row: {
          id: string
          takeoff_id: string
          takeoff_item_id: string | null
          content: string
          comment_type: 'general' | 'question' | 'suggestion' | 'issue'
          parent_comment_id: string | null
          created_by: string
          created_at: string
          updated_at: string
          is_resolved: boolean
        }
        Insert: {
          id?: string
          takeoff_id: string
          takeoff_item_id?: string | null
          content: string
          comment_type?: 'general' | 'question' | 'suggestion' | 'issue'
          parent_comment_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          is_resolved?: boolean
        }
        Update: {
          id?: string
          takeoff_id?: string
          takeoff_item_id?: string | null
          content?: string
          comment_type?: 'general' | 'question' | 'suggestion' | 'issue'
          parent_comment_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          is_resolved?: boolean
        }
      }
      takeoff_presence: {
        Row: {
          id: string
          takeoff_id: string
          user_id: string
          last_seen_at: string
          current_view: string | null
          cursor_position: any | null
        }
        Insert: {
          id?: string
          takeoff_id: string
          user_id: string
          last_seen_at?: string
          current_view?: string | null
          cursor_position?: any | null
        }
        Update: {
          id?: string
          takeoff_id?: string
          user_id?: string
          last_seen_at?: string
          current_view?: string | null
          cursor_position?: any | null
        }
      }
      cost_templates: {
        Row: {
          id: string
          user_id: string | null
          is_global: boolean
          name: string
          trade_category: string
          description: string | null
          template_data: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          is_global?: boolean
          name: string
          trade_category: string
          description?: string | null
          template_data: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          is_global?: boolean
          name?: string
          trade_category?: string
          description?: string | null
          template_data?: any
          created_at?: string
          updated_at?: string
        }
      }
      takeoff_ai_chat: {
        Row: {
          id: string
          takeoff_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          references_items: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          takeoff_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          references_items?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          takeoff_id?: string
          user_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          references_items?: string[] | null
          created_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          num_pages: number
          title: string | null
          description: string | null
          project_name: string | null
          project_location: string | null
          status: string
          processing_status: any
          has_takeoff_analysis: boolean
          has_quality_analysis: boolean
          created_at: string
          updated_at: string
          last_accessed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          num_pages?: number
          title?: string | null
          description?: string | null
          project_name?: string | null
          project_location?: string | null
          status?: string
          processing_status?: any
          has_takeoff_analysis?: boolean
          has_quality_analysis?: boolean
          created_at?: string
          updated_at?: string
          last_accessed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          num_pages?: number
          title?: string | null
          description?: string | null
          project_name?: string | null
          project_location?: string | null
          status?: string
          processing_status?: any
          has_takeoff_analysis?: boolean
          has_quality_analysis?: boolean
          created_at?: string
          updated_at?: string
          last_accessed_at?: string
        }
      }
      plan_takeoff_analysis: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          items: any
          summary: any
          ai_model: string | null
          confidence_scores: any
          processing_time_ms: number | null
          edited_items: any
          is_finalized: boolean
          version: number
          parent_version_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          items?: any
          summary?: any
          ai_model?: string | null
          confidence_scores?: any
          processing_time_ms?: number | null
          edited_items?: any
          is_finalized?: boolean
          version?: number
          parent_version_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string
          items?: any
          summary?: any
          ai_model?: string | null
          confidence_scores?: any
          processing_time_ms?: number | null
          edited_items?: any
          is_finalized?: boolean
          version?: number
          parent_version_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      plan_quality_analysis: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          overall_score: number | null
          issues: any
          missing_details: any
          recommendations: any
          findings_by_category: any
          findings_by_severity: any
          page_findings: any
          ai_model: string | null
          processing_time_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          overall_score?: number | null
          issues?: any
          missing_details?: any
          recommendations?: any
          findings_by_category?: any
          findings_by_severity?: any
          page_findings?: any
          ai_model?: string | null
          processing_time_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string
          overall_score?: number | null
          issues?: any
          missing_details?: any
          recommendations?: any
          findings_by_category?: any
          findings_by_severity?: any
          page_findings?: any
          ai_model?: string | null
          processing_time_ms?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
