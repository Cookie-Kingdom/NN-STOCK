/* Hand-written Supabase schema types (review MNT-08), in the shape `supabase gen types
 * typescript` emits, covering only what the app calls: the four app_state RPCs and the
 * tables session.ts reads. Keep it in step with supabase/migrations when one of those
 * changes; regenerate the whole file instead once the CLI can reach a project. */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UserRole =
  | "L1_OWNER"
  | "L1_MANAGER"
  | "L2_BRANCH_ADMIN"
  | "L3_CM_OPERATOR"
  | "L4_SUPPLIER";
type LocationKind =
  "CENTRAL" | "CHEF_HOUSE" | "BRANCH" | "SUPPLIER_STORAGE" | "STEAK_PRODUCTION";
type RiceModel = "EXTERNAL_COOKED" | "SELF_COOK";

export type Database = {
  public: {
    Tables: {
      /* Migration 20260908000002. */
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role: UserRole;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          code: string;
          name_th: string;
          kind: LocationKind;
          rice_model: RiceModel | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code: string;
          name_th: string;
          kind: LocationKind;
          rice_model?: RiceModel | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Insert"]>;
        Relationships: [];
      };
      user_locations: {
        Row: {
          id: string;
          profile_id: string;
          location_id: string;
          can_receive_central: boolean;
        };
        Insert: {
          id?: string;
          profile_id: string;
          location_id: string;
          can_receive_central?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_locations"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_locations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      /* Role-scoped copy of the payload (migration 20260925000028). */
      load_app_state: {
        Args: never;
        Returns: { payload: Json; revision: number }[];
      };
      /* Migration 20260925000023; returns the new revision (0017). */
      save_app_state: {
        Args: { p_payload: Json; p_expected_revision?: number | null };
        Returns: { revision: number; updated_at: string }[];
      };
      /* Non-owner delta save (migration 20260925000028); returns the new revision. */
      append_entries: {
        Args: {
          p_expected_revision: number | null;
          p_entries: Json;
          p_lots?: Json;
        };
        Returns: number;
      };
      app_state_revision: { Args: never; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      location_kind: LocationKind;
      rice_model: RiceModel;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
