export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      athletes: {
        Row: {
          age_category: string | null
          bib_number: string | null
          birth_date: string | null
          club: string | null
          country: string | null
          created_at: string
          difficulty_codes: string[] | null
          difficulty_sheet: Json
          full_name: string
          gender: string | null
          id: string
          status: string
          style: string | null
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          age_category?: string | null
          bib_number?: string | null
          birth_date?: string | null
          club?: string | null
          country?: string | null
          created_at?: string
          difficulty_codes?: string[] | null
          difficulty_sheet?: Json
          full_name: string
          gender?: string | null
          id?: string
          status?: string
          style?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          age_category?: string | null
          bib_number?: string | null
          birth_date?: string | null
          club?: string | null
          country?: string | null
          created_at?: string
          difficulty_codes?: string[] | null
          difficulty_sheet?: Json
          full_name?: string
          gender?: string | null
          id?: string
          status?: string
          style?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      current_match: {
        Row: {
          athlete_id: string | null
          elapsed_ms: number
          payload: Json
          session_code: string
          started_at: string | null
          style: string | null
          ta_deductions: Json
          timer_state: string
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          elapsed_ms?: number
          payload?: Json
          session_code: string
          started_at?: string | null
          style?: string | null
          ta_deductions?: Json
          timer_state?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          elapsed_ms?: number
          payload?: Json
          session_code?: string
          started_at?: string | null
          style?: string | null
          ta_deductions?: Json
          timer_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "current_match_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_requests: {
        Row: {
          assigned_slot: string | null
          created_at: string
          id: string
          judge_name: string
          requested_role: string
          session_code: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_slot?: string | null
          created_at?: string
          id?: string
          judge_name: string
          requested_role: string
          session_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_slot?: string | null
          created_at?: string
          id?: string
          judge_name?: string
          requested_role?: string
          session_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      judge_scores: {
        Row: {
          athlete_id: string | null
          id: string
          judge_role: string
          judge_slot: string
          payload: Json | null
          score: number | null
          session_code: string
          submitted: boolean
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          id?: string
          judge_role: string
          judge_slot: string
          payload?: Json | null
          score?: number | null
          session_code: string
          submitted?: boolean
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          id?: string
          judge_role?: string
          judge_slot?: string
          payload?: Json | null
          score?: number | null
          session_code?: string
          submitted?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      judge_status: {
        Row: {
          athlete_id: string | null
          id: string
          judge_slot: string
          session_code: string
          state: string
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          id?: string
          judge_slot: string
          session_code: string
          state?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          id?: string
          judge_slot?: string
          session_code?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          session_code: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          session_code: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          session_code?: string
        }
        Relationships: []
      }
      match_results: {
        Row: {
          athlete_id: string
          athlete_name: string | null
          created_at: string
          deductions: number | null
          final_score: number
          id: string
          payload: Json | null
          published: boolean
          score_a: number | null
          score_b: number | null
          score_c: number | null
          session_code: string
          style: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_name?: string | null
          created_at?: string
          deductions?: number | null
          final_score: number
          id?: string
          payload?: Json | null
          published?: boolean
          score_a?: number | null
          score_b?: number | null
          score_c?: number | null
          session_code: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_name?: string | null
          created_at?: string
          deductions?: number | null
          final_score?: number
          id?: string
          payload?: Json | null
          published?: boolean
          score_a?: number | null
          score_b?: number | null
          score_c?: number | null
          session_code?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_members: {
        Row: {
          created_at: string
          id: string
          role: string | null
          session_code: string
          slot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          session_code: string
          slot?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          session_code?: string
          slot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          active: boolean
          created_at: string
          end_date: string | null
          id: string
          location: string | null
          name: string
          session_code: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          session_code?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          session_code?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_report: { Args: { _athlete_id: string }; Returns: Json }
      is_active_session: { Args: { _code: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
