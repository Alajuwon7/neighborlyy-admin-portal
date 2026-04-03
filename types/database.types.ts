// Auto-generated types from Supabase schema.
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      property_managers: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          company_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          company_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          company_name?: string | null;
          updated_at?: string;
        };
      };
      communities: {
        Row: {
          id: string;
          property_manager_id: string | null;
          name: string;
          community_code: string;
          street_address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          unit_count: number | null;
          property_type: "apartment" | "condo" | "student" | "senior" | null;
          logo_url: string | null;
          hero_image_url: string | null;
          primary_color: string | null;
          accent_color: string | null;
          admin_code: string | null;
          status: "trial" | "active" | "suspended" | "cancelled";
          onboarding_completed: boolean;
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_tier:
            | "starter"
            | "professional"
            | "enterprise"
            | "white_label"
            | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_manager_id: string;
          name: string;
          community_code: string;
          street_address: string;
          city: string;
          state: string;
          zip_code: string;
          unit_count: number;
          property_type: "apartment" | "condo" | "student" | "senior";
          logo_url?: string | null;
          hero_image_url?: string | null;
          primary_color?: string;
          accent_color?: string;
          admin_code: string;
          status?: "trial" | "active" | "suspended" | "cancelled";
          onboarding_completed?: boolean;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_tier?:
            | "starter"
            | "professional"
            | "enterprise"
            | "white_label"
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_manager_id?: string;
          name?: string;
          community_code?: string;
          street_address?: string;
          city?: string;
          state?: string;
          zip_code?: string;
          unit_count?: number;
          property_type?: "apartment" | "condo" | "student" | "senior";
          logo_url?: string | null;
          hero_image_url?: string | null;
          primary_color?: string;
          accent_color?: string;
          admin_code?: string;
          status?: "trial" | "active" | "suspended" | "cancelled";
          onboarding_completed?: boolean;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_tier?:
            | "starter"
            | "professional"
            | "enterprise"
            | "white_label"
            | null;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          community_id: string;
          property_manager_id: string | null;
          email: string;
          full_name: string;
          role: "owner" | "manager" | "assistant_manager" | "leasing_agent";
          status: "invited" | "active" | "deactivated";
          invited_at: string;
          joined_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          property_manager_id?: string | null;
          email: string;
          full_name: string;
          role: "owner" | "manager" | "assistant_manager" | "leasing_agent";
          status?: "invited" | "active" | "deactivated";
          invited_at?: string;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          property_manager_id?: string | null;
          email?: string;
          full_name?: string;
          role?: "owner" | "manager" | "assistant_manager" | "leasing_agent";
          status?: "invited" | "active" | "deactivated";
          joined_at?: string | null;
          updated_at?: string;
        };
      };
      subscription_history: {
        Row: {
          id: string;
          community_id: string;
          event_type:
            | "created"
            | "upgraded"
            | "downgraded"
            | "cancelled"
            | "reactivated";
          from_tier: string | null;
          to_tier: string | null;
          amount: number | null;
          stripe_event_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          event_type:
            | "created"
            | "upgraded"
            | "downgraded"
            | "cancelled"
            | "reactivated";
          from_tier?: string | null;
          to_tier?: string | null;
          amount?: number | null;
          stripe_event_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      analytics_events: {
        Row: {
          id: string;
          community_id: string;
          event_type: string;
          user_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          event_type: string;
          user_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      // Mobile app tables (shared database)
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          community_code: string;
          unit_number: string | null;
          status: "pending" | "approved" | "denied";
          role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          community_code: string;
          unit_number?: string | null;
          status?: "pending" | "approved" | "denied";
          role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          unit_number?: string | null;
          status?: "pending" | "approved" | "denied";
          role?: string | null;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          community_code: string;
          title: string;
          description: string | null;
          location: string | null;
          start_time: string;
          end_time: string | null;
          created_by: string | null;
          rsvp_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_code: string;
          title: string;
          description?: string | null;
          location?: string | null;
          start_time: string;
          end_time?: string | null;
          created_by?: string | null;
          rsvp_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          location?: string | null;
          start_time?: string;
          end_time?: string | null;
          rsvp_count?: number;
          updated_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          community_code: string;
          title: string;
          message: string;
          priority: "urgent" | "high" | "medium" | "low";
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_code: string;
          title: string;
          message: string;
          priority: "urgent" | "high" | "medium" | "low";
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          message?: string;
          priority?: "urgent" | "high" | "medium" | "low";
        };
      };
      facilities: {
        Row: {
          id: string;
          community_code: string;
          name: string;
          description: string | null;
          type: string;
          is_available: boolean;
          hours: string | null;
          rules: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_code: string;
          name: string;
          description?: string | null;
          type: string;
          is_available?: boolean;
          hours?: string | null;
          rules?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          type?: string;
          is_available?: boolean;
          hours?: string | null;
          rules?: string | null;
          image_url?: string | null;
          updated_at?: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          facility_id: string;
          user_id: string;
          community_code: string;
          start_time: string;
          end_time: string;
          status: "pending" | "confirmed" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          user_id: string;
          community_code: string;
          start_time: string;
          end_time: string;
          status?: "pending" | "confirmed" | "cancelled";
          created_at?: string;
        };
        Update: {
          status?: "pending" | "confirmed" | "cancelled";
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
