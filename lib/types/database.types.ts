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
          next_billing_date: string
          payment_method: string | null
          provider_url: string | null
          notes: string | null
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
          next_billing_date: string
          payment_method?: string | null
          provider_url?: string | null
          notes?: string | null
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
          next_billing_date?: string
          payment_method?: string | null
          provider_url?: string | null
          notes?: string | null
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
