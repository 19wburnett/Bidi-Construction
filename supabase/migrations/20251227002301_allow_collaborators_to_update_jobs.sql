    -- Allow collaborators (not just owners) to update jobs
    -- This updates the RLS policy to use is_job_member instead of is_job_owner

    DROP POLICY IF EXISTS "Members can update jobs" ON jobs;

    CREATE POLICY "Members can update jobs"
    ON jobs FOR UPDATE
    USING (
        is_job_member(jobs.id, auth.uid())
    )
    WITH CHECK (
        is_job_member(jobs.id, auth.uid())
    );

