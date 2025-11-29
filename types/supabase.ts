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
                    email: string | null
                    full_name: string | null
                    phone: string | null
                    role: 'admin' | 'bdm' | null
                    region: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    email?: string | null
                    full_name?: string | null
                    role?: 'admin' | 'bdm' | null
                    region?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    email?: string | null
                    full_name?: string | null
                    role?: 'admin' | 'bdm' | null
                    region?: string | null
                    updated_at?: string | null
                }
            }
            customers: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    type: string | null
                    contact_person: string | null
                    phone: string | null
                    address: string | null
                    stage: string | null
                    location_lat: number | null
                    location_lng: number | null
                    assigned_to: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    type?: string | null
                    contact_person?: string | null
                    phone?: string | null
                    address?: string | null
                    stage?: string | null
                    location_lat?: number | null
                    location_lng?: number | null
                    assigned_to: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    type?: string | null
                    contact_person?: string | null
                    phone?: string | null
                    address?: string | null
                    stage?: string | null
                    location_lat?: number | null
                    location_lng?: number | null
                    assigned_to?: string
                    site_description?: string | null
                    architect_id?: string | null
                    builder_id?: string | null
                    dealer_id?: string | null
                    site_photo_url?: string | null
                    profession?: string | null
                }
            }
            visits: {
                Row: {
                    id: string
                    created_at: string
                    customer_id: string
                    user_id: string
                    timestamp: string
                    purpose: string | null
                    outcome: string | null
                    notes: string | null
                    location_lat: number | null
                    location_lng: number | null
                    photo_url: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    customer_id: string
                    user_id: string
                    timestamp?: string
                    purpose?: string | null
                    outcome?: string | null
                    notes?: string | null
                    location_lat?: number | null
                    location_lng?: number | null
                    photo_url?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    customer_id?: string
                    user_id?: string
                    timestamp?: string
                    purpose?: string | null
                    outcome?: string | null
                    notes?: string | null
                    location_lat?: number | null
                    location_lng?: number | null
                    photo_url?: string | null
                }
            }
            tasks: {
                Row: {
                    id: string
                    created_at: string
                    customer_id: string | null
                    user_id: string
                    description: string
                    due_date: string | null
                    is_completed: boolean | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    customer_id?: string | null
                    user_id: string
                    description: string
                    due_date?: string | null
                    is_completed?: boolean | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    customer_id?: string | null
                    user_id?: string
                    description?: string
                    due_date?: string | null
                    is_completed?: boolean | null
                }
            }
        }
    }
}
