import type { SupabaseClient } from '@supabase/supabase-js'

type GenericSupabase = SupabaseClient<any, any, any> | {
  from: SupabaseClient['from']
}

/**
 * Check if a user is a member of a job (owner or collaborator).
 */
export async function userHasJobAccess(
  supabase: GenericSupabase,
  jobId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('job_members')
    .select('id')
    .eq('job_id', jobId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to verify job access:', error)
    return false
  }

  return Boolean(data)
}

/**
 * Retrieve a job the user has access to, along with the membership role.
 * Returns null if the user is not a member.
 */
type JobWithRole = {
  role: 'owner' | 'collaborator'
  job: Record<string, unknown> | null
  last_viewed_at?: string
}

export async function getJobForUser<T extends string = '*'>(
  supabase: GenericSupabase,
  jobId: string,
  userId: string,
  columns: T = '*' as T
): Promise<{ job: any; role: 'owner' | 'collaborator' } | null> {
  const { data, error } = await supabase
    .from('job_members')
    .select(
      `
        role,
        job:jobs(${columns})
      `
    )
    .eq('job_id', jobId)
    .eq('user_id', userId)
    .maybeSingle<JobWithRole>()

  if (error) {
    console.error('Failed to fetch job for user:', error)
    return null
  }

  if (!data?.job) {
    return null
  }

  return {
    job: data.job,
    role: data.role as 'owner' | 'collaborator'
  }
}

/**
 * List all jobs a user can access.
 */
export async function listJobsForUser<T extends string = '*'>(
  supabase: GenericSupabase,
  userId: string,
  columns: T = '*' as T
): Promise<Array<{ job: any; role: 'owner' | 'collaborator'; last_viewed_at?: string }>> {
  const { data, error } = await supabase
    .from('job_members')
    .select(
      `
        role,
        last_viewed_at,
        job:jobs(${columns})
      `
    )
    .eq('user_id', userId)
    .returns<JobWithRole[]>()

  if (error) {
    console.error('Failed to list jobs for user:', error)
    return []
  }

  return (data || [])
    .filter((row) => row.job)
    .map((row) => ({
      job: row.job,
      role: row.role,
      last_viewed_at: (row as any).last_viewed_at
    }))
}

