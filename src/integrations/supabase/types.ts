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
      service_calls: {
        Row: {
          id: string
          table_id: string
          message: string
          resolved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          table_id: string
          message?: string
          resolved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          table_id?: string
          message?: string
          resolved?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {

        Row: {
          code: string
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kitchen_tickets: {
        Row: {
          channel: Database["public"]["Enums"]["kitchen_channel"]
          created_at: string
          done_at: string | null
          id: string
          note: string
          order_id: string
          received_at: string | null
          sent_at: string
          station: string
          status: Database["public"]["Enums"]["kitchen_ticket_status"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["kitchen_channel"]
          created_at?: string
          done_at?: string | null
          id?: string
          note?: string
          order_id: string
          received_at?: string | null
          sent_at?: string
          station?: string
          status?: Database["public"]["Enums"]["kitchen_ticket_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["kitchen_channel"]
          created_at?: string
          done_at?: string | null
          id?: string
          note?: string
          order_id?: string
          received_at?: string | null
          sent_at?: string
          station?: string
          status?: Database["public"]["Enums"]["kitchen_ticket_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string | null
          is_popular: boolean
          name: string
          price: number
          status: Database["public"]["Enums"]["menu_status"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_popular?: boolean
          name: string
          price?: number
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_popular?: boolean
          name?: string
          price?: number
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_id: string | null
          menu_name: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id?: string | null
          menu_name?: string
          order_id: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string | null
          menu_name?: string
          order_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_count: number
          customer_name: string
          discount_amount: number
          final_amount: number
          id: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_count?: number
          customer_name?: string
          discount_amount?: number
          final_amount?: number
          id?: string
          order_number: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_count?: number
          customer_name?: string
          discount_amount?: number
          final_amount?: number
          id?: string
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_due: number
          amount_received: number
          change_amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string
          order_id: string
        }
        Insert: {
          amount_due?: number
          amount_received?: number
          change_amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string
          order_id: string
        }
        Update: {
          amount_due?: number
          amount_received?: number
          change_amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          banner_url: string | null
          code: string
          created_at: string
          description: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          end_date: string | null
          id: string
          min_spend: number
          start_date: string | null
          status: Database["public"]["Enums"]["promo_status"]
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          code: string
          created_at?: string
          description?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          end_date?: string | null
          id?: string
          min_spend?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["promo_status"]
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          code?: string
          created_at?: string
          description?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          end_date?: string | null
          id?: string
          min_spend?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["promo_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          banner_url: string | null
          created_at: string
          hero_subtitle: string
          hero_title: string
          id: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          service_charge_rate: number
          store_name: string
          system_name: string
          tagline: string
          updated_at: string
          vat_rate: number
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_notify_enabled?: boolean | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          hero_subtitle?: string
          hero_title?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          service_charge_rate?: number
          store_name?: string
          system_name?: string
          tagline?: string
          updated_at?: string
          vat_rate?: number
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_notify_enabled?: boolean | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          hero_subtitle?: string
          hero_title?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          service_charge_rate?: number
          store_name?: string
          system_name?: string
          tagline?: string
          updated_at?: string
          vat_rate?: number
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_notify_enabled?: boolean | null
        }
        Relationships: []
      }
      tables: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          qr_code_url: string | null
          status: Database["public"]["Enums"]["table_status"]
          updated_at: string
          zone: Database["public"]["Enums"]["table_zone"]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          qr_code_url?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
          zone?: Database["public"]["Enums"]["table_zone"]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          qr_code_url?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
          zone?: Database["public"]["Enums"]["table_zone"]
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
      discount_type: "percentage" | "fixed_amount"
      kitchen_channel: "manual" | "api"
      kitchen_ticket_status:
        | "sent"
        | "received"
        | "cooking"
        | "done"
        | "cancelled"
      menu_status: "available" | "out_of_stock"
      order_status:
        | "waiting"
        | "in_kitchen"
        | "served"
        | "completed"
        | "cancelled"
      order_type: "dine_in" | "takeaway"
      payment_method: "cash" | "transfer" | "card"
      promo_status: "active" | "inactive"
      table_status: "available" | "occupied" | "disabled"
      table_zone: "indoor" | "terrace"
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
    Enums: {
      discount_type: ["percentage", "fixed_amount"],
      kitchen_channel: ["manual", "api"],
      kitchen_ticket_status: [
        "sent",
        "received",
        "cooking",
        "done",
        "cancelled",
      ],
      menu_status: ["available", "out_of_stock"],
      order_status: [
        "waiting",
        "in_kitchen",
        "served",
        "completed",
        "cancelled",
      ],
      order_type: ["dine_in", "takeaway"],
      payment_method: ["cash", "transfer", "card"],
      promo_status: ["active", "inactive"],
      table_status: ["available", "occupied", "disabled"],
      table_zone: ["indoor", "terrace"],
    },
  },
} as const
