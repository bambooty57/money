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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          content: string
          created_at: string
          customer_id: string | null
          id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          customer_id?: string | null
          id?: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_prospects: {
        Row: {
          created_at: string | null
          current_device_model: string | null
          current_device_model_id: string | null
          customer_id: string
          id: string
          memo: string | null
          prospect_device_model: string[] | null
          prospect_device_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_device_model?: string | null
          current_device_model_id?: string | null
          customer_id: string
          id?: string
          memo?: string | null
          prospect_device_model?: string[] | null
          prospect_device_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_device_model?: string | null
          current_device_model_id?: string | null
          customer_id?: string
          id?: string
          memo?: string | null
          prospect_device_model?: string[] | null
          prospect_device_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_prospects_current_device_model_id_fkey"
            columns: ["current_device_model_id"]
            isOneToOne: false
            referencedRelation: "models_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prospects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          address_jibun: string | null
          address_road: string | null
          business_name: string | null
          business_no: string | null
          created_at: string
          customer_type: string | null
          customer_type_multi: Json | null
          fax: string | null
          id: string
          is_admin: boolean | null
          memo: string | null
          mobile: string | null
          name: string
          phone: string
          representative_name: string | null
          ssn: string | null
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          address?: string | null
          address_jibun?: string | null
          address_road?: string | null
          business_name?: string | null
          business_no?: string | null
          created_at?: string
          customer_type?: string | null
          customer_type_multi?: Json | null
          fax?: string | null
          id?: string
          is_admin?: boolean | null
          memo?: string | null
          mobile?: string | null
          name: string
          phone: string
          representative_name?: string | null
          ssn?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          address?: string | null
          address_jibun?: string | null
          address_road?: string | null
          business_name?: string | null
          business_no?: string | null
          created_at?: string
          customer_type?: string | null
          customer_type_multi?: Json | null
          fax?: string | null
          id?: string
          is_admin?: boolean | null
          memo?: string | null
          mobile?: string | null
          name?: string
          phone?: string
          representative_name?: string | null
          ssn?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          created_at: string | null
          customer_id: string | null
          event_type: string
          id: string
          message: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          event_type: string
          id?: string
          message?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          event_type?: string
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          name: string
          transaction_id: string | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          name: string
          transaction_id?: string | null
          type: string
          url: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          name?: string
          transaction_id?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_actions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_actions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      models_types: {
        Row: {
          created_at: string | null
          id: string
          model: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          model: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string
          type?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          account_holder: string | null
          account_number: string | null
          amount: number
          bank_name: string | null
          card_name: string | null
          cash_detail: string | null
          cash_place: string | null
          cash_receiver: string | null
          cheques: string | null
          created_at: string | null
          detail: string | null
          id: string
          method: string
          note: string | null
          paid_at: string
          paid_by: string | null
          paid_location: string | null
          payer_name: string | null
          transaction_id: string | null
          used_at: string | null
          used_by: string | null
          used_model: string | null
          used_model_type: string | null
          used_place: string | null
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          amount: number
          bank_name?: string | null
          card_name?: string | null
          cash_detail?: string | null
          cash_place?: string | null
          cash_receiver?: string | null
          cheques?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          method: string
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          paid_location?: string | null
          payer_name?: string | null
          transaction_id?: string | null
          used_at?: string | null
          used_by?: string | null
          used_model?: string | null
          used_model_type?: string | null
          used_place?: string | null
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          card_name?: string | null
          cash_detail?: string | null
          cash_place?: string | null
          cash_receiver?: string | null
          cheques?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          paid_location?: string | null
          payer_name?: string | null
          transaction_id?: string | null
          used_at?: string | null
          used_by?: string | null
          used_model?: string | null
          used_model_type?: string | null
          used_place?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          content: string
          created_at: string
          customer_id: string | null
          id: string
          phone: string | null
          sent_at: string
          status: string | null
        }
        Insert: {
          content: string
          created_at?: string
          customer_id?: string | null
          id?: string
          phone?: string | null
          sent_at?: string
          status?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          phone?: string | null
          sent_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance: number
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          model: string | null
          model_type: string | null
          models_types_id: string | null
          paid_amount: number | null
          paid_ratio: number | null
          status: string | null
          type: string
          unpaid_amount: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          balance?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          model?: string | null
          model_type?: string | null
          models_types_id?: string | null
          paid_amount?: number | null
          paid_ratio?: number | null
          status?: string | null
          type: string
          unpaid_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          model?: string | null
          model_type?: string | null
          models_types_id?: string | null
          paid_amount?: number | null
          paid_ratio?: number | null
          status?: string | null
          type?: string
          unpaid_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_models_types_id_fkey"
            columns: ["models_types_id"]
            isOneToOne: false
            referencedRelation: "models_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      monthly_sales_stats: {
        Args: never
        Returns: {
          month: string
          total: number
        }[]
      }
      monthly_unpaid_stats: {
        Args: never
        Returns: {
          month: string
          total: number
        }[]
      }
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
