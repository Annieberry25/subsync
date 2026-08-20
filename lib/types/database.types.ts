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
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
