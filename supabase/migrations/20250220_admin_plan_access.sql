-- Allow admin users to view all plans regardless of membership
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'plans'
      AND policyname = 'Admins can view all plans'
  ) THEN
    DROP POLICY "Admins can view all plans" ON plans;
  END IF;
END$$;

CREATE POLICY "Admins can view all plans"
  ON plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
  );

