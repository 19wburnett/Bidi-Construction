'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function updatePlanTitle(planId: string, newTitle: string) {
  const supabase = await createServerSupabaseClient()

  try {
    const { data, error } = await supabase
      .from('plans')
      .update({ title: newTitle })
      .eq('id', planId)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/dashboard/plans')
    revalidatePath(`/dashboard/plans/${planId}`)
    if (data.job_id) {
        revalidatePath(`/dashboard/jobs/${data.job_id}`)
        revalidatePath(`/dashboard/jobs/${data.job_id}/plans/${planId}`)
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error updating plan title:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update plan title' }
  }
}
