-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can create usage logs" ON usage_logs;

-- Create new policies for usage_logs
CREATE POLICY "Anyone can create usage logs"
  ON usage_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all usage logs"
  ON usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can view their own usage logs"
  ON usage_logs
  FOR SELECT
  USING (
    user_id IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Make user_id optional
ALTER TABLE usage_logs 
ALTER COLUMN user_id DROP NOT NULL;