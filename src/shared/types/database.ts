
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "agenda_blocks": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string,"ends_at": string,"id": string,"staff_id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string,"ends_at": string,"id"?: string,"staff_id": string,"starts_at": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string,"ends_at"?: string,"id"?: string,"staff_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agenda_blocks_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agenda_blocks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agenda_blocks_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "booked_by": Database["public"]['Enums']["booked_by"],"business_id": string,"cancelled_at": string | null,"cancelled_by": string | null,"client_id": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"guest_name": string | null,"id": string,"note": string | null,"price": number,"punctuality": number | null,"punctuality_at": string | null,"recurring_id": string | null,"service_id": string,"staff_id": string,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_by"?: Database["public"]['Enums']["booked_by"],"business_id": string,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"guest_name"?: string | null,"id"?: string,"note"?: string | null,"price": number,"punctuality"?: number | null,"punctuality_at"?: string | null,"recurring_id"?: string | null,"service_id": string,"staff_id": string,"starts_at": string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "booked_by"?: Database["public"]['Enums']["booked_by"],"business_id"?: string,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"guest_name"?: string | null,"id"?: string,"note"?: string | null,"price"?: number,"punctuality"?: number | null,"punctuality_at"?: string | null,"recurring_id"?: string | null,"service_id"?: string,"staff_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_recurring_id_fkey"
      columns: ["recurring_id"]
isOneToOne: false
      referencedRelation: "recurring_bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"business_link_codes": {
                  Row: {
                    "business_id": string,"code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"code": string
                  }
                  Update: {
                    "business_id"?: string,"code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_link_codes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address": string,"cancel_limit_minutes": number,"city": string,"cover_url": string | null,"created_at": string,"id": string,"is_listed": boolean,"kind": string,"lat": number | null,"lng": number | null,"logo_url": string | null,"max_advance_days": number | null,"min_notice_minutes": number,"name": string,"neighborhood": string | null,"online_booking": boolean,"owner_id": string,"show_owner_agenda": boolean,"slot_interval_minutes": number,"slug": string,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"cancel_limit_minutes"?: number,"city"?: string,"cover_url"?: string | null,"created_at"?: string,"id"?: string,"is_listed"?: boolean,"kind": string,"lat"?: number | null,"lng"?: number | null,"logo_url"?: string | null,"max_advance_days"?: number | null,"min_notice_minutes"?: number,"name": string,"neighborhood"?: string | null,"online_booking"?: boolean,"owner_id": string,"show_owner_agenda"?: boolean,"slot_interval_minutes"?: number,"slug": string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "address"?: string,"cancel_limit_minutes"?: number,"city"?: string,"cover_url"?: string | null,"created_at"?: string,"id"?: string,"is_listed"?: boolean,"kind"?: string,"lat"?: number | null,"lng"?: number | null,"logo_url"?: string | null,"max_advance_days"?: number | null,"min_notice_minutes"?: number,"name"?: string,"neighborhood"?: string | null,"online_booking"?: boolean,"owner_id"?: string,"show_owner_agenda"?: boolean,"slot_interval_minutes"?: number,"slug"?: string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "businesses_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "birth_date": string | null,"business_id": string,"created_at": string,"created_by": string | null,"full_name": string,"gender": string | null,"id": string,"is_blocked": boolean,"notes": string | null,"phone": string | null,"profile_id": string | null,"promos_ok": boolean,"updated_at": string,"whatsapp_ok": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"full_name": string,"gender"?: string | null,"id"?: string,"is_blocked"?: boolean,"notes"?: string | null,"phone"?: string | null,"profile_id"?: string | null,"promos_ok"?: boolean,"updated_at"?: string,"whatsapp_ok"?: boolean
                  }
                  Update: {
                    "birth_date"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"full_name"?: string,"gender"?: string | null,"id"?: string,"is_blocked"?: boolean,"notes"?: string | null,"phone"?: string | null,"profile_id"?: string | null,"promos_ok"?: boolean,"updated_at"?: string,"whatsapp_ok"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"demo_messages": {
                  Row: {
                    "body": string,"booking_id": string | null,"channel": Database["public"]['Enums']["message_channel"],"created_at": string,"deliver_at": string,"id": string,"kind": string,"read_at": string | null,"recipient_id": string | null,"recipient_phone": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"booking_id"?: string | null,"channel": Database["public"]['Enums']["message_channel"],"created_at"?: string,"deliver_at"?: string,"id"?: string,"kind": string,"read_at"?: string | null,"recipient_id"?: string | null,"recipient_phone": string,"title": string
                  }
                  Update: {
                    "body"?: string,"booking_id"?: string | null,"channel"?: Database["public"]['Enums']["message_channel"],"created_at"?: string,"deliver_at"?: string,"id"?: string,"kind"?: string,"read_at"?: string | null,"recipient_id"?: string | null,"recipient_phone"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "demo_messages_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "demo_messages_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"business_id": string,"category": Database["public"]['Enums']["expense_category"],"created_at": string,"created_by": string | null,"id": string,"name": string,"paid_on": string,"payment_method_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"category": Database["public"]['Enums']["expense_category"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"paid_on": string,"payment_method_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"category"?: Database["public"]['Enums']["expense_category"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"paid_on"?: string,"payment_method_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "business_id": string,"created_at": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"profile_id"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_items": {
                  Row: {
                    "business_id": string,"commission": number | null,"commission_pct": number,"id": string,"invoice_id": string,"position": number,"price": number,"service_id": string,"staff_id": string,"staff_payment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"commission"?: never,"commission_pct": number,"id"?: string,"invoice_id": string,"position"?: number,"price": number,"service_id": string,"staff_id": string,"staff_payment_id"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"commission"?: never,"commission_pct"?: number,"id"?: string,"invoice_id"?: string,"position"?: number,"price"?: number,"service_id"?: string,"staff_id"?: string,"staff_payment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_staff_payment_id_fkey"
      columns: ["staff_payment_id"]
isOneToOne: false
      referencedRelation: "staff_payments"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "booking_id": string | null,"business_id": string,"client_id": string | null,"created_at": string,"created_by": string | null,"guest_name": string | null,"id": string,"issued_on": string,"number": number,"payment_method_id": string,"status": Database["public"]['Enums']["invoice_status"],"total": number,"updated_at": string,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"business_id": string,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"guest_name"?: string | null,"id"?: string,"issued_on": string,"number": number,"payment_method_id": string,"status"?: Database["public"]['Enums']["invoice_status"],"total": number,"updated_at"?: string,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "booking_id"?: string | null,"business_id"?: string,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"guest_name"?: string | null,"id"?: string,"issued_on"?: string,"number"?: number,"payment_method_id"?: string,"status"?: Database["public"]['Enums']["invoice_status"],"total"?: number,"updated_at"?: string,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"position"?: number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_methods_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_visits": {
                  Row: {
                    "business_id": string,"id": number,"visited_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"id"?: never,"visited_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"id"?: never,"visited_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_visits_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"birth_date": string | null,"created_at": string,"full_name": string | null,"gender": string | null,"id": string,"phone": string,"share_phone_on_booking": boolean,"share_phone_with_followed": boolean,"updated_at": string,"whatsapp_booking_messages": boolean,"whatsapp_promotions": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"birth_date"?: string | null,"created_at"?: string,"full_name"?: string | null,"gender"?: string | null,"id": string,"phone": string,"share_phone_on_booking"?: boolean,"share_phone_with_followed"?: boolean,"updated_at"?: string,"whatsapp_booking_messages"?: boolean,"whatsapp_promotions"?: boolean
                  }
                  Update: {
                    "avatar_url"?: string | null,"birth_date"?: string | null,"created_at"?: string,"full_name"?: string | null,"gender"?: string | null,"id"?: string,"phone"?: string,"share_phone_on_booking"?: boolean,"share_phone_with_followed"?: boolean,"updated_at"?: string,"whatsapp_booking_messages"?: boolean,"whatsapp_promotions"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "business_id": string,"created_at": string,"description": string | null,"discount_pct": number | null,"ends_on": string | null,"id": string,"image_url": string | null,"is_active": boolean,"kind": string,"name": string,"price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"description"?: string | null,"discount_pct"?: number | null,"ends_on"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"kind": string,"name": string,"price": number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"description"?: string | null,"discount_pct"?: number | null,"ends_on"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"kind"?: string,"name"?: string,"price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"recurring_bookings": {
                  Row: {
                    "business_id": string,"client_id": string,"created_at": string,"created_by": string,"frequency": Database["public"]['Enums']["recurring_frequency"],"id": string,"occurrences": number,"service_id": string,"staff_id": string,"start_time": string,"starts_on": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"client_id": string,"created_at"?: string,"created_by"?: string,"frequency": Database["public"]['Enums']["recurring_frequency"],"id"?: string,"occurrences": number,"service_id": string,"staff_id": string,"start_time": string,"starts_on": string,"weekday": number
                  }
                  Update: {
                    "business_id"?: string,"client_id"?: string,"created_at"?: string,"created_by"?: string,"frequency"?: Database["public"]['Enums']["recurring_frequency"],"id"?: string,"occurrences"?: number,"service_id"?: string,"staff_id"?: string,"start_time"?: string,"starts_on"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_bookings_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_bookings_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "attention": number,"author_id": string,"booking_id": string,"business_id": string,"comment": string | null,"created_at": string,"id": string,"quality": number,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attention": number,"author_id"?: string,"booking_id": string,"business_id": string,"comment"?: string | null,"created_at"?: string,"id"?: string,"quality": number,"staff_id": string
                  }
                  Update: {
                    "attention"?: number,"author_id"?: string,"booking_id"?: string,"business_id"?: string,"comment"?: string | null,"created_at"?: string,"id"?: string,"quality"?: number,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"service_categories": {
                  Row: {
                    "business_id": string,"id": string,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"id"?: string,"name": string,"position"?: number
                  }
                  Update: {
                    "business_id"?: string,"id"?: string,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "audience": string,"business_id": string,"category_id": string,"created_at": string,"description": string | null,"duration_minutes": number,"id": string,"is_active": boolean,"name": string,"position": number,"price": number,"price_to": number | null,"price_type": Database["public"]['Enums']["price_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"business_id": string,"category_id": string,"created_at"?: string,"description"?: string | null,"duration_minutes": number,"id"?: string,"is_active"?: boolean,"name": string,"position"?: number,"price": number,"price_to"?: number | null,"price_type"?: Database["public"]['Enums']["price_type"],"updated_at"?: string
                  }
                  Update: {
                    "audience"?: string,"business_id"?: string,"category_id"?: string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"position"?: number,"price"?: number,"price_to"?: number | null,"price_type"?: Database["public"]['Enums']["price_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "service_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "business_id": string,"created_at": string,"display_name": string,"id": string,"is_active": boolean,"position": number,"profile_id": string,"role": Database["public"]['Enums']["staff_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"display_name": string,"id"?: string,"is_active"?: boolean,"position"?: number,"profile_id": string,"role"?: Database["public"]['Enums']["staff_role"]
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"position"?: number,"profile_id"?: string,"role"?: Database["public"]['Enums']["staff_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_payments": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"note": string | null,"paid_on": string,"payment_method_id": string,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"paid_on": string,"payment_method_id": string,"staff_id": string
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"paid_on"?: string,"payment_method_id"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_payments_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_payments_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_services": {
                  Row: {
                    "commission_pct": number | null,"duration_minutes": number | null,"price": number | null,"service_id": string,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "commission_pct"?: number | null,"duration_minutes"?: number | null,"price"?: number | null,"service_id": string,"staff_id": string
                  }
                  Update: {
                    "commission_pct"?: number | null,"duration_minutes"?: number | null,"price"?: number | null,"service_id"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_services_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"team_permissions": {
                  Row: {
                    "business_id": string,"internal_clients": boolean,"invoicing": boolean,"manual_block": boolean,"manual_booking": boolean,"see_client_phone": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"internal_clients"?: boolean,"invoicing"?: boolean,"manual_block"?: boolean,"manual_booking"?: boolean,"see_client_phone"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"internal_clients"?: boolean,"invoicing"?: boolean,"manual_block"?: boolean,"manual_booking"?: boolean,"see_client_phone"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_permissions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"work_hours": {
                  Row: {
                    "business_id": string,"ends": string,"id": string,"staff_id": string | null,"starts": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"ends": string,"id"?: string,"staff_id"?: string | null,"starts": string,"weekday": number
                  }
                  Update: {
                    "business_id"?: string,"ends"?: string,"id"?: string,"staff_id"?: string | null,"starts"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_hours_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_hours_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "business_rating": {
                  Row: {
                    "attention": number | null,"business_id": string,"quality": number | null,"reviews": number | null,"score": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "reviews_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_rating": {
                  Row: {
                    "reviews": number | null,"score": number | null,"staff_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "reviews_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "booking_is_invoiced":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"booking_notify":
{ Args: { "p_body": string,"p_booking": string,"p_channel": Database["public"]['Enums']["message_channel"],"p_deliver_at"?: string,"p_kind": string,"p_profile": string,"p_title": string }; Returns: undefined
                           },
"booking_reminders":
{ Args: { "p_address": string,"p_booking": string,"p_business": string,"p_client_profile": string,"p_service": string,"p_staff": string,"p_starts_at": string }; Returns: undefined
                           },
"booking_time_text":
{ Args: { "p_at": string }; Returns: string
                           },
"booking_when_text":
{ Args: { "p_at": string }; Returns: string
                           },
"business_clients":
{ Args: { "p_business": string }; Returns: {
              "full_name": string,"has_account": boolean,"id": string,"is_blocked": boolean,"phone": string
            }[]
                           },
"business_followers":
{ Args: { "p_business": string }; Returns: {
              "followed_at": string,"full_name": string
            }[]
                           },
"business_insights":
{ Args: { "p_business": string }; Returns: {
              "client_bookings": number,"followers": number,"visits": number
            }[]
                           },
"business_stats":
{ Args: { "p_business"?: string }; Returns: {
              "bookings": number,"business_id": string,"followers": number,"following": boolean,"reviews": number,"score": number
            }[]
                           },
"busy_ranges":
{ Args: { "p_day": string,"p_except"?: string,"p_staff": string }; Returns: {
              "ends_at": string,"starts_at": string
            }[]
                           },
"client_book":
{ Args: { "p_promos"?: boolean,"p_service": string,"p_staff": string,"p_starts_at": string }; Returns: string
                           },
"client_booking_rules":
{ Args: { "p_business": string,"p_ends_at": string,"p_staff": string,"p_starts_at": string }; Returns: undefined
                           },
"client_cancel":
{ Args: { "p_booking": string }; Returns: undefined
                           },
"client_notes":
{ Args: { "p_client": string }; Returns: string
                           },
"client_own_booking":
{ Args: { "p_booking": string }; Returns: {
              "business_id": string,"service_id": string,"staff_id": string
            }[]
                           },
"client_phone":
{ Args: { "p_client": string }; Returns: string
                           },
"client_reputation":
{ Args: { "p_profile": string }; Returns: {
              "rated_bookings": number,"score": number
            }[]
                           },
"client_reschedule":
{ Args: { "p_booking": string,"p_starts_at": string }; Returns: undefined
                           },
"client_service_terms":
{ Args: { "p_service": string,"p_staff": string }; Returns: {
              "business_id": string,"minutes": number,"price": number
            }[]
                           },
"client_stats":
{ Args: { "p_business": string }; Returns: {
              "birth_date": string,"birthday_in": number,"client_id": string,"days_away": number,"full_name": string,"has_account": boolean,"invoiced": number,"is_blocked": boolean,"last_visit": string,"phone": string,"visits": number
            }[]
                           },
"create_demo_person":
{ Args: { "p_name": string,"p_order": number,"p_phone": string,"p_side": string }; Returns: string
                           },
"home_counters":
{ Args: { "p_business": string }; Returns: {
              "bookings": number,"followers": number,"invoices": number,"rating": number,"reviews": number
            }[]
                           },
"invoice_all_mine":
{ Args: { "p_invoice": string }; Returns: boolean
                           },
"invoice_can_write":
{ Args: { "p_business": string,"p_staff_ids": (string)[] }; Returns: undefined
                           },
"is_owner_of":
{ Args: { "p_business": string }; Returns: boolean
                           },
"is_staff_of":
{ Args: { "p_business": string }; Returns: boolean
                           },
"link_staff":
{ Args: { "p_code": string,"p_display_name": string }; Returns: string
                           },
"my_phone":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_staff_id":
{ Args: { "p_business": string }; Returns: string
                           },
"new_link_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pay_staff":
{ Args: { "p_business": string,"p_day": string,"p_method": string,"p_note"?: string,"p_staff": string }; Returns: string
                           },
"payroll":
{ Args: { "p_business": string }; Returns: {
              "display_name": string,"invoices": number,"is_active": boolean,"items": number,"pending": number,"staff_id": string,"unmarked": number
            }[]
                           },
"record_profile_visit":
{ Args: { "p_business": string }; Returns: undefined
                           },
"report_commissions":
{ Args: { "p_business": string,"p_from": string,"p_staff"?: string,"p_to": string }; Returns: {
              "earned": number,"name": string,"paid": number,"pending": number,"sold": number,"staff_id": string
            }[]
                           },
"report_guard":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: undefined
                           },
"report_methods":
{ Args: { "p_business": string,"p_from": string,"p_to": string }; Returns: {
              "invoices": number,"is_active": boolean,"method_id": string,"name": string,"total": number
            }[]
                           },
"report_services":
{ Args: { "p_business": string,"p_from": string,"p_staff"?: string,"p_to": string }; Returns: {
              "name": string,"service_id": string,"times": number,"total": number
            }[]
                           },
"report_summary":
{ Args: { "p_business": string,"p_from": string,"p_staff"?: string,"p_to": string }; Returns: {
              "commissions": number,"expenses": number,"invoices": number,"products": number,"services": number
            }[]
                           },
"reset_demo":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"save_invoice":
{ Args: { "p_booking"?: string,"p_business": string,"p_client"?: string,"p_guest_name"?: string,"p_invoice"?: string,"p_items": Json,"p_method": string }; Returns: string
                           },
"seed_demo":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"seed_demo_agenda":
{ Args: { "p_business": string,"p_scale": number }; Returns: undefined
                           },
"seed_demo_bookings":
{ Args: { "p_business": string }; Returns: undefined
                           },
"seed_demo_clients":
{ Args: { "p_business": string,"p_owner": string }; Returns: undefined
                           },
"seed_demo_follows":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"seed_demo_money":
{ Args: { "p_business": string }; Returns: undefined
                           },
"seed_demo_promotions":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"seed_demo_reports":
{ Args: { "p_business": string }; Returns: undefined
                           },
"seed_demo_reviews":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"seed_demo_simple_clients":
{ Args: { "p_business": string }; Returns: undefined
                           },
"send_sms_demo":
{ Args: { "event": Json }; Returns: Json
                           },
"staff_commission":
{ Args: { "p_service": string,"p_staff": string }; Returns: number
                           },
"staff_commissions":
{ Args: { "p_staff": string }; Returns: {
              "commission_pct": number,"service_id": string
            }[]
                           },
"team_can":
{ Args: { "p_business": string,"p_permission": string }; Returns: boolean
                           },
"void_invoice":
{ Args: { "p_invoice": string }; Returns: undefined
                           }
          }
          Enums: {
            "booked_by": "owner"|"staff"|"client","booking_status": "pending"|"successful"|"unsuccessful"|"cancelled","expense_category": "rent"|"utilities"|"payroll"|"supplies"|"maintenance"|"advertising"|"other","invoice_status": "paid"|"void","message_channel": "sms"|"whatsapp"|"push","price_type": "fixed"|"from"|"range","recurring_frequency": "weekly"|"biweekly"|"monthly","staff_role": "owner"|"staff"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "booked_by": ["owner", "staff", "client"],"booking_status": ["pending", "successful", "unsuccessful", "cancelled"],"expense_category": ["rent", "utilities", "payroll", "supplies", "maintenance", "advertising", "other"],"invoice_status": ["paid", "void"],"message_channel": ["sms", "whatsapp", "push"],"price_type": ["fixed", "from", "range"],"recurring_frequency": ["weekly", "biweekly", "monthly"],"staff_role": ["owner", "staff"]
          }
        }
} as const
