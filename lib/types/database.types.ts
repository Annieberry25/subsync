export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          plan_tier: string
          plan_expires_at: string | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          plan_tier?: string
          plan_expires_at?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          plan_tier?: string
          plan_expires_at?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_subscriptions: {
        Row: {
          id: string
          user_id: string
          paystack_reference: string
          plan: string
          status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
          amount: number
          currency: string
          access_code: string | null
          paid_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paystack_reference: string
          plan?: string
          status?: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
          amount: number
          currency?: string
          access_code?: string | null
          paid_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paystack_reference?: string
          plan?: string
          status?: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
          amount?: number
          currency?: string
          access_code?: string | null
          paid_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          name: string
          price: number
          currency: string
          billing_cycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom'
          category: 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other'
          status: 'active' | 'paused' | 'canceled' | 'trial'
          start_date: string | null
          end_date?: string | null
          next_billing_date: string
          payment_method: string | null
          provider_url: string | null
          notes: string | null
          account_links?: { id?: string; label?: string; url: string; email?: string }[] | null
          receipts?: { id: string; fileName: string; uploadDate: string; price?: number | null; currency?: string | null; provider?: string | null; rawText?: string | null; fileUrl?: string | null }[] | null
          is_synced?: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          price: number
          currency?: string
          billing_cycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom'
          category: 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other'
          status?: 'active' | 'paused' | 'canceled' | 'trial'
          start_date?: string | null
          end_date?: string | null
          next_billing_date: string
          payment_method?: string | null
          provider_url?: string | null
          notes?: string | null
          account_links?: { id?: string; label?: string; url: string; email?: string }[] | null
          receipts?: { id: string; fileName: string; uploadDate: string; price?: number | null; currency?: string | null; provider?: string | null; rawText?: string | null; fileUrl?: string | null }[] | null
          is_synced?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          price?: number
          currency?: string
          billing_cycle?: 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom'
          category?: 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other'
          status?: 'active' | 'paused' | 'canceled' | 'trial'
          start_date?: string | null
          end_date?: string | null
          next_billing_date?: string
          payment_method?: string | null
          provider_url?: string | null
          notes?: string | null
          account_links?: { id?: string; label?: string; url: string; email?: string }[] | null
          receipts?: { id: string; fileName: string; uploadDate: string; price?: number | null; currency?: string | null; provider?: string | null; rawText?: string | null; fileUrl?: string | null }[] | null
          is_synced?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
          referencedColumns: ["id"]
          }
        ]
      }
      bill_payments: {
        Row: {
          id: string
          user_id: string
          category: string
          custom_category: string | null
          provider_name: string
          amount: number
          currency: string
          payment_date: string
          country: string | null
          region: string | null
          city: string | null
          payment_frequency: 'one_time' | 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom' | null
          is_recurring: boolean
          notes: string | null
          receipts: { id: string; fileName: string; uploadDate: string; price?: number | null; currency?: string | null; provider?: string | null; rawText?: string | null; fileUrl?: string | null }[] | null
          source: 'manual' | 'receipt_scan' | 'email_discovered'
          provider_reference: string | null
          official_provider_url: string | null
          status: 'paid' | 'pending' | 'overdue'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          custom_category?: string | null
          provider_name: string
          amount: number
          currency?: string
          payment_date?: string
          country?: string | null
          region?: string | null
          city?: string | null
          payment_frequency?: 'one_time' | 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom' | null
          is_recurring?: boolean
          notes?: string | null
          receipts?: { id: string; fileName: string; uploadDate: string; price?: number | null; currency?: string | null; provider?: string | null; rawText?: string | null; fileUrl?: string | null }[] | null
          source?: 'manual' | 'receipt_scan' | 'email_discovered'
          provider_reference?: string | null
          official_provider_url?: string | null
          status?: 'paid' | 'pending' | 'overdue'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          custom_category?: string | null
          provider_name?: string
          amount?: number
          currency?: string
          payment_date?: string
          country?: string | null
          region?: string | null
          city?: string | null
          payment_frequency?: 'one_time' | 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom' | null
          is_recurring?: boolean
          notes?: string | null
          receipts?: { id: string; fileName: string; uploadDate: string; price?: number | null; currency?: string | null; provider?: string | null; rawText?: string | null; fileUrl?: string | null }[] | null
          source?: 'manual' | 'receipt_scan' | 'email_discovered'
          provider_reference?: string | null
          official_provider_url?: string | null
          status?: 'paid' | 'pending' | 'overdue'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      receipt_scan_usage: {
        Row: {
          id: string
          user_id: string
          source: 'upload' | 'paste' | 'email' | 'gmail'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source?: 'upload' | 'paste' | 'email' | 'gmail'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source?: 'upload' | 'paste' | 'email' | 'gmail'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_scan_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      receipts: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          bill_payment_id: string | null
          storage_path: string
          file_name: string
          mime_type: string
          byte_size: number
          amount: number | null
          currency: string | null
          provider: string | null
          payment_date: string | null
          extraction_confidence: Record<string, string> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          bill_payment_id?: string | null
          storage_path: string
          file_name: string
          mime_type: string
          byte_size: number
          amount?: number | null
          currency?: string | null
          provider?: string | null
          payment_date?: string | null
          extraction_confidence?: Record<string, string> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          bill_payment_id?: string | null
          storage_path?: string
          file_name?: string
          mime_type?: string
          byte_size?: number
          amount?: number | null
          currency?: string | null
          provider?: string | null
          payment_date?: string | null
          extraction_confidence?: Record<string, string> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_bill_payment_id_fkey"
            columns: ["bill_payment_id"]
            isOneToOne: false
            referencedRelation: "bill_payments"
            referencedColumns: ["id"]
          }
        ]
      }
      bill_providers: {
        Row: {
          id: string
          name: string
          category: string
          country: string
          region: string | null
          official_website: string | null
          official_payment_url: string | null
          verification_status: 'verified' | 'user_submitted' | 'unverified'
          supported_regions: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          country?: string
          region?: string | null
          official_website?: string | null
          official_payment_url?: string | null
          verification_status?: 'verified' | 'user_submitted' | 'unverified'
          supported_regions?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          country?: string
          region?: string | null
          official_website?: string | null
          official_payment_url?: string | null
          verification_status?: 'verified' | 'user_submitted' | 'unverified'
          supported_regions?: string[] | null
          created_at?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          subscription_name: string | null
          type: string
          title: string
          description: string | null
          amount: number | null
          currency: string | null
          metadata: Json | null
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          subscription_name?: string | null
          type: string
          title: string
          description?: string | null
          amount?: number | null
          currency?: string | null
          metadata?: Json | null
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          subscription_name?: string | null
          type?: string
          title?: string
          description?: string | null
          amount?: number | null
          currency?: string | null
          metadata?: Json | null
          timestamp?: string
          created_at?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          description: string | null
          date: string
          is_read: boolean
          is_favourited: boolean
          is_urgent: boolean
          action_type: string | null
          action_label: string | null
          subscription_name: string | null
          subscription_price: number | null
          currency: string | null
          provider_url: string | null
          metadata: Json | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          description?: string | null
          date?: string
          is_read?: boolean
          is_favourited?: boolean
          is_urgent?: boolean
          action_type?: string | null
          action_label?: string | null
          subscription_name?: string | null
          subscription_price?: number | null
          currency?: string | null
          provider_url?: string | null
          metadata?: Json | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          description?: string | null
          date?: string
          is_read?: boolean
          is_favourited?: boolean
          is_urgent?: boolean
          action_type?: string | null
          action_label?: string | null
          subscription_name?: string | null
          subscription_price?: number | null
          currency?: string | null
          provider_url?: string | null
          metadata?: Json | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          id: string
          user_id: string
          email: string
          credentials: Json
          scope: string | null
          status: 'connected' | 'revoked' | 'error'
          last_scan_at: string | null
          last_scan_status: string | null
          last_scan_count: number | null
          connected_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          credentials: Json
          scope?: string | null
          status?: 'connected' | 'revoked' | 'error'
          last_scan_at?: string | null
          last_scan_status?: string | null
          last_scan_count?: number | null
          connected_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          credentials?: Json
          scope?: string | null
          status?: 'connected' | 'revoked' | 'error'
          last_scan_at?: string | null
          last_scan_status?: string | null
          last_scan_count?: number | null
          connected_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gmail_connections_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_user_name: {
        Args: {
          p_full_name: string
        }
        Returns: Database['public']['CompositeTypes']['name_change_result']
      }
      check_rate_limit: {
        Args: {
          p_bucket_key: string
          p_window_seconds?: number
          p_max_requests?: number
        }
        Returns: Database['public']['CompositeTypes']['rate_limit_result']
      }
      set_user_admin: {
        Args: {
          target_user_id: string
          make_admin: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      name_change_result: {
        success: boolean
        message: string | null
        last_changed_at: string | null
        next_allowed_at: string | null
      }
      rate_limit_result: {
        allowed: boolean
        retry_after_seconds: number
        count: number
        limit_value: number
      }
    }
  }
}
