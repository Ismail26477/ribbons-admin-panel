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
      amc_contracts: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["amc_frequency"]
          id: string
          next_service_date: string
          notes: string | null
          service_type: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["amc_frequency"]
          id?: string
          next_service_date?: string
          notes?: string | null
          service_type?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["amc_frequency"]
          id?: string
          next_service_date?: string
          notes?: string | null
          service_type?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          account_no: string | null
          bank_name: string | null
          branch: string | null
          company_address: string | null
          company_email: string | null
          company_name: string
          company_name_alt: string | null
          company_phone: string | null
          customer_care_phone: string | null
          default_cgst_rate: number | null
          default_gst_rate: number | null
          default_sgst_rate: number | null
          gstin: string | null
          gstin_nashik: string | null
          ho_address: string | null
          id: number
          ifsc_code: string | null
          ivrs_api_key: string | null
          low_stock_threshold: number
          nashik_address: string | null
          point_value_inr: number
          pts_extra_work: number
          pts_fast_arrival: number
          pts_high: number
          pts_low: number
          pts_normal: number
          pts_per_star: number
          pts_review: number
          pts_selfie: number
          pts_tools_return: number
          pts_urgent: number
          terms_conditions: string | null
          website_ho: string | null
          website_nashik: string | null
        }
        Insert: {
          account_no?: string | null
          bank_name?: string | null
          branch?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_name_alt?: string | null
          company_phone?: string | null
          customer_care_phone?: string | null
          default_cgst_rate?: number | null
          default_gst_rate?: number | null
          default_sgst_rate?: number | null
          gstin?: string | null
          gstin_nashik?: string | null
          ho_address?: string | null
          id?: number
          ifsc_code?: string | null
          ivrs_api_key?: string | null
          low_stock_threshold?: number
          nashik_address?: string | null
          point_value_inr?: number
          pts_extra_work?: number
          pts_fast_arrival?: number
          pts_high?: number
          pts_low?: number
          pts_normal?: number
          pts_per_star?: number
          pts_review?: number
          pts_selfie?: number
          pts_tools_return?: number
          pts_urgent?: number
          terms_conditions?: string | null
          website_ho?: string | null
          website_nashik?: string | null
        }
        Update: {
          account_no?: string | null
          bank_name?: string | null
          branch?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_name_alt?: string | null
          company_phone?: string | null
          customer_care_phone?: string | null
          default_cgst_rate?: number | null
          default_gst_rate?: number | null
          default_sgst_rate?: number | null
          gstin?: string | null
          gstin_nashik?: string | null
          ho_address?: string | null
          id?: number
          ifsc_code?: string | null
          ivrs_api_key?: string | null
          low_stock_threshold?: number
          nashik_address?: string | null
          point_value_inr?: number
          pts_extra_work?: number
          pts_fast_arrival?: number
          pts_high?: number
          pts_low?: number
          pts_normal?: number
          pts_per_star?: number
          pts_review?: number
          pts_selfie?: number
          pts_tools_return?: number
          pts_urgent?: number
          terms_conditions?: string | null
          website_ho?: string | null
          website_nashik?: string | null
        }
        Relationships: []
      }
      assignment_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          issue_type: string | null
          priority: Database["public"]["Enums"]["complaint_priority"] | null
          sort_order: number
          technician_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          issue_type?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"] | null
          sort_order?: number
          technician_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          issue_type?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"] | null
          sort_order?: number
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          bonus_extra_work: boolean
          bonus_fast_arrival: boolean
          bonus_review: boolean
          bonus_selfie: boolean
          bonus_tools_return: boolean
          completed_at: string | null
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string
          description: string | null
          feedback_token: string | null
          id: string
          issue_type: string | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          rating: number | null
          source: Database["public"]["Enums"]["complaint_source"]
          status: Database["public"]["Enums"]["complaint_status"]
          technician_id: string | null
          ticket_no: string
          updated_at: string
        }
        Insert: {
          bonus_extra_work?: boolean
          bonus_fast_arrival?: boolean
          bonus_review?: boolean
          bonus_selfie?: boolean
          bonus_tools_return?: boolean
          completed_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone: string
          description?: string | null
          feedback_token?: string | null
          id?: string
          issue_type?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          rating?: number | null
          source?: Database["public"]["Enums"]["complaint_source"]
          status?: Database["public"]["Enums"]["complaint_status"]
          technician_id?: string | null
          ticket_no: string
          updated_at?: string
        }
        Update: {
          bonus_extra_work?: boolean
          bonus_fast_arrival?: boolean
          bonus_review?: boolean
          bonus_selfie?: boolean
          bonus_tools_return?: boolean
          completed_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string
          description?: string | null
          feedback_token?: string | null
          id?: string
          issue_type?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          rating?: number | null
          source?: Database["public"]["Enums"]["complaint_source"]
          status?: Database["public"]["Enums"]["complaint_status"]
          technician_id?: string | null
          ticket_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          comment: string | null
          complaint_id: string
          created_at: string
          customer_name: string | null
          feedback_token: string
          id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          complaint_id: string
          created_at?: string
          customer_name?: string | null
          feedback_token: string
          id?: string
          rating: number
        }
        Update: {
          comment?: string | null
          complaint_id?: string
          created_at?: string
          customer_name?: string | null
          feedback_token?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      eta_links: {
        Row: {
          complaint_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          technician_id: string
          token: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          technician_id: string
          token?: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          technician_id?: string
          token?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          bill_url: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          bill_url?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          bill_url?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      factories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location: string | null
          manager_name: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location?: string | null
          manager_name?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location?: string | null
          manager_name?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active: boolean
          barcode: string
          category: string | null
          cost: number
          created_at: string
          description: string | null
          hsn_code: string | null
          id: string
          item_code: string
          low_stock_threshold: number
          name: string
          quantity: number
          selling_price: number
          supplier: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode: string
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          hsn_code?: string | null
          id?: string
          item_code: string
          low_stock_threshold?: number
          name: string
          quantity?: number
          selling_price?: number
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          hsn_code?: string | null
          id?: string
          item_code?: string
          low_stock_threshold?: number
          name?: string
          quantity?: number
          selling_price?: number
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          complaint_id: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number
          technician_id: string | null
          txn_type: Database["public"]["Enums"]["inv_txn_type"]
        }
        Insert: {
          complaint_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          technician_id?: string | null
          txn_type: Database["public"]["Enums"]["inv_txn_type"]
        }
        Update: {
          complaint_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          technician_id?: string | null
          txn_type?: Database["public"]["Enums"]["inv_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_no: string | null
          advanced_amount: number
          bank_name: string | null
          branch: string | null
          cgst_amount: number
          cgst_rate: number
          city: string | null
          company_gstin: string | null
          company_name_override: string | null
          complaint_id: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_date: string | null
          department: string | null
          discount: number
          doc_no: string
          due_date: string | null
          id: string
          ifsc_code: string | null
          invoice_type: string | null
          issued_date: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          line_items: Json
          location: string | null
          notes: string | null
          party_gstin: string | null
          payment_mode: string | null
          po_date: string | null
          po_number: string | null
          product_details: string | null
          round_off: number
          service_charge_rate: number
          sgst_amount: number
          sgst_rate: number
          source_quotation_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          terms_text: string | null
          total: number
          updated_at: string
        }
        Insert: {
          account_no?: string | null
          advanced_amount?: number
          bank_name?: string | null
          branch?: string | null
          cgst_amount?: number
          cgst_rate?: number
          city?: string | null
          company_gstin?: string | null
          company_name_override?: string | null
          complaint_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_date?: string | null
          department?: string | null
          discount?: number
          doc_no: string
          due_date?: string | null
          id?: string
          ifsc_code?: string | null
          invoice_type?: string | null
          issued_date?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          line_items?: Json
          location?: string | null
          notes?: string | null
          party_gstin?: string | null
          payment_mode?: string | null
          po_date?: string | null
          po_number?: string | null
          product_details?: string | null
          round_off?: number
          service_charge_rate?: number
          sgst_amount?: number
          sgst_rate?: number
          source_quotation_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms_text?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          account_no?: string | null
          advanced_amount?: number
          bank_name?: string | null
          branch?: string | null
          cgst_amount?: number
          cgst_rate?: number
          city?: string | null
          company_gstin?: string | null
          company_name_override?: string | null
          complaint_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_date?: string | null
          department?: string | null
          discount?: number
          doc_no?: string
          due_date?: string | null
          id?: string
          ifsc_code?: string | null
          invoice_type?: string | null
          issued_date?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          line_items?: Json
          location?: string | null
          notes?: string | null
          party_gstin?: string | null
          payment_mode?: string | null
          po_date?: string | null
          po_number?: string | null
          product_details?: string | null
          round_off?: number
          service_charge_rate?: number
          sgst_amount?: number
          sgst_rate?: number
          source_quotation_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms_text?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      ivrs_call_logs: {
        Row: {
          call_sid: string | null
          caller_phone: string | null
          complaint_id: string | null
          created_at: string
          digits: string | null
          id: string
          issue_type: string | null
          raw_payload: Json | null
        }
        Insert: {
          call_sid?: string | null
          caller_phone?: string | null
          complaint_id?: string | null
          created_at?: string
          digits?: string | null
          id?: string
          issue_type?: string | null
          raw_payload?: Json | null
        }
        Update: {
          call_sid?: string | null
          caller_phone?: string | null
          complaint_id?: string | null
          created_at?: string
          digits?: string | null
          id?: string
          issue_type?: string | null
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ivrs_call_logs_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          level: string
          link: string | null
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          link?: string | null
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      point_events: {
        Row: {
          complaint_id: string | null
          created_at: string
          id: string
          points: number
          reason: string
          technician_id: string
        }
        Insert: {
          complaint_id?: string | null
          created_at?: string
          id?: string
          points: number
          reason: string
          technician_id: string
        }
        Update: {
          complaint_id?: string | null
          created_at?: string
          id?: string
          points?: number
          reason?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_events_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          factory_id: string
          id: string
          log_date: string
          notes: string | null
          units_produced: number
        }
        Insert: {
          created_at?: string
          factory_id: string
          id?: string
          log_date?: string
          notes?: string | null
          units_produced?: number
        }
        Update: {
          created_at?: string
          factory_id?: string
          id?: string
          log_date?: string
          notes?: string | null
          units_produced?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      technician_checkins: {
        Row: {
          address: string | null
          check_in_at: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          complaint_id: string | null
          created_at: string
          id: string
          notes: string | null
          technician_id: string
        }
        Insert: {
          address?: string | null
          check_in_at?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          complaint_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          technician_id: string
        }
        Update: {
          address?: string | null
          check_in_at?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          complaint_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          technician_id?: string
        }
        Relationships: []
      }
      technician_locations: {
        Row: {
          accuracy: number | null
          address: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          status: string
          technician_id: string
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          status?: string
          technician_id: string
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          status?: string
          technician_id?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          active: boolean
          address: string | null
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          base_salary: number
          blood_group: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          designation: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          gender: string | null
          id: string
          id_proof_number: string | null
          id_proof_type: string | null
          joining_date: string | null
          name: string
          notes: string | null
          phone: string | null
          pincode: string | null
          skills: string[] | null
          state: string | null
          total_points: number
          type: Database["public"]["Enums"]["tech_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          base_salary?: number
          blood_group?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: string | null
          id?: string
          id_proof_number?: string | null
          id_proof_type?: string | null
          joining_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          skills?: string[] | null
          state?: string | null
          total_points?: number
          type?: Database["public"]["Enums"]["tech_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          base_salary?: number
          blood_group?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: string | null
          id?: string
          id_proof_number?: string | null
          id_proof_type?: string | null
          joining_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          skills?: string[] | null
          state?: string | null
          total_points?: number
          type?: Database["public"]["Enums"]["tech_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      eta_get_link: {
        Args: { _token: string }
        Returns: {
          complaint_id: string
          customer_address: string
          customer_name: string
          expires_at: string
          technician_id: string
          technician_name: string
          technician_phone: string
          ticket_no: string
        }[]
      }
      eta_get_location: {
        Args: { _token: string }
        Returns: {
          address: string
          created_at: string
          lat: number
          lng: number
          status: string
        }[]
      }
      eta_token_valid: { Args: { _token: string }; Returns: string }
      feedback_token_valid: {
        Args: { _complaint_id: string; _token: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      process_amc_due: { Args: never; Returns: undefined }
    }
    Enums: {
      amc_frequency: "monthly" | "quarterly" | "half_yearly" | "yearly"
      app_role: "admin" | "manager" | "accountant" | "technician"
      complaint_priority: "low" | "normal" | "high" | "urgent"
      complaint_source: "ivrs" | "manual" | "web"
      complaint_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "completed"
        | "reopened"
        | "cancelled"
      expense_category:
        | "salary"
        | "inventory"
        | "travel"
        | "utilities"
        | "rent"
        | "misc"
      inv_txn_type: "issue" | "use" | "return" | "damage" | "restock"
      invoice_kind: "quotation" | "invoice" | "purchase_order"
      invoice_status:
        | "draft"
        | "sent"
        | "paid"
        | "overdue"
        | "cancelled"
        | "converted"
        | "partial"
        | "approved"
        | "rejected"
      tech_type: "full_time" | "on_call"
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
    Enums: {
      amc_frequency: ["monthly", "quarterly", "half_yearly", "yearly"],
      app_role: ["admin", "manager", "accountant", "technician"],
      complaint_priority: ["low", "normal", "high", "urgent"],
      complaint_source: ["ivrs", "manual", "web"],
      complaint_status: [
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "reopened",
        "cancelled",
      ],
      expense_category: [
        "salary",
        "inventory",
        "travel",
        "utilities",
        "rent",
        "misc",
      ],
      inv_txn_type: ["issue", "use", "return", "damage", "restock"],
      invoice_kind: ["quotation", "invoice", "purchase_order"],
      invoice_status: [
        "draft",
        "sent",
        "paid",
        "overdue",
        "cancelled",
        "converted",
        "partial",
        "approved",
        "rejected",
      ],
      tech_type: ["full_time", "on_call"],
    },
  },
} as const
