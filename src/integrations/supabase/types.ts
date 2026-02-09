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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      booking_rules: {
        Row: {
          description: string | null
          id: string
          rule_key: string
          rule_value: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          rule_key: string
          rule_value: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          rule_key?: string
          rule_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booker_comment: string | null
          booker_email: string | null
          booker_geburtsjahr: number
          booker_nachname: string
          booker_vorname: string
          booking_type: string
          court_number: number
          created_at: string
          created_by_admin: boolean
          date: string
          double_match_names: string | null
          id: string
          is_joined: boolean
          partner_comment: string | null
          partner_geburtsjahr: number | null
          partner_nachname: string | null
          partner_vorname: string | null
          recurrence_end_date: string | null
          recurrence_parent_id: string | null
          recurrence_type: string | null
          special_label: string | null
          start_hour: number
        }
        Insert: {
          booker_comment?: string | null
          booker_email?: string | null
          booker_geburtsjahr: number
          booker_nachname: string
          booker_vorname: string
          booking_type: string
          court_number: number
          created_at?: string
          created_by_admin?: boolean
          date: string
          double_match_names?: string | null
          id?: string
          is_joined?: boolean
          partner_comment?: string | null
          partner_geburtsjahr?: number | null
          partner_nachname?: string | null
          partner_vorname?: string | null
          recurrence_end_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          special_label?: string | null
          start_hour: number
        }
        Update: {
          booker_comment?: string | null
          booker_email?: string | null
          booker_geburtsjahr?: number
          booker_nachname?: string
          booker_vorname?: string
          booking_type?: string
          court_number?: number
          created_at?: string
          created_by_admin?: boolean
          date?: string
          double_match_names?: string | null
          id?: string
          is_joined?: boolean
          partner_comment?: string | null
          partner_geburtsjahr?: number | null
          partner_nachname?: string | null
          partner_vorname?: string | null
          recurrence_end_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          special_label?: string | null
          start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          email: string | null
          geburtsjahr: number
          id: string
          nachname: string
          vorname: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          geburtsjahr: number
          id?: string
          nachname: string
          vorname: string
        }
        Update: {
          created_at?: string
          email?: string | null
          geburtsjahr?: number
          id?: string
          nachname?: string
          vorname?: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
