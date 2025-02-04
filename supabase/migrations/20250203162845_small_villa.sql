-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can create usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;

-- Add proper foreign key constraints
ALTER TABLE usage_logs
DROP CONSTRAINT IF EXISTS usage_logs_user_id_fkey,
ADD CONSTRAINT usage_logs_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE usage_logs
DROP CONSTRAINT IF EXISTS usage_logs_chatbot_id_fkey,
ADD CONSTRAINT usage_logs_chatbot_id_fkey 
  FOREIGN KEY (chatbot_id) 
  REFERENCES chatbot_templates(id) 
  ON DELETE CASCADE;

-- Create indexes for better join performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_chatbot_id ON usage_logs(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Create new policies with proper permissions
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
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = usage_logs.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Create function to track token usage
CREATE OR REPLACE FUNCTION track_token_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tokens_used IS NOT NULL AND NEW.tokens_used > 0 THEN
    INSERT INTO usage_logs (
      user_id,
      chatbot_id,
      tokens_used,
      created_at
    ) VALUES (
      NEW.user_id,
      NEW.chatbot_id,
      NEW.tokens_used,
      COALESCE(NEW.created_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for chat sessions
DROP TRIGGER IF EXISTS track_usage_on_chat ON chat_sessions;

CREATE TRIGGER track_usage_on_chat
  AFTER INSERT OR UPDATE ON chat_sessions
  FOR EACH ROW
  WHEN (NEW.tokens_used IS NOT NULL AND NEW.tokens_used > 0)
  EXECUTE FUNCTION track_token_usage();