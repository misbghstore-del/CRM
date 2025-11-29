'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTask(prevState: any, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'You must be logged in to create a task' }
    }

    const description = formData.get('description') as string
    const due_date = formData.get('due_date') as string
    const customer_id = formData.get('customer_id') as string
    const priority = formData.get('priority') as string || 'Normal'

    if (!description || !due_date) {
        return { error: 'Description and Due Date are required' }
    }

    const { error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            customer_id: customer_id || null,
            description,
            due_date,
            priority,
            is_completed: false
        })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/planner')
    revalidatePath('/dashboard')
    return { message: 'Task created successfully', success: true }
}

export async function getTasks(date: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data } = await supabase
        .from('tasks')
        .select('*, customers(name)')
        .eq('user_id', user.id)
        .eq('due_date', date)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })

    return data || []
}
