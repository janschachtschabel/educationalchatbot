-- Drop existing triggers and functions first
DROP TRIGGER IF EXISTS track_usage_on_chat ON chat_sessions;
DROP FUNCTION IF EXISTS track_token_usage();

-- Create improved token usage tracking function
CREATE OR REPLACE FUNCTION track_token_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_tokens integer;
BEGIN
  -- Calculate token difference
  v_tokens := NEW.tokens_used;

  -- Only track if there are tokens to count
  IF v_tokens > 0 THEN
    -- Insert usage log
    INSERT INTO usage_logs (
      user_id,
      chatbot_id,
      tokens_used,
      created_at
    ) VALUES (
      NEW.user_id,
      NEW.chatbot_id,
      v_tokens,
      COALESCE(NEW.created_at, now())
    );

    -- Update chatbot usage statistics
    UPDATE chatbot_templates
    SET 
      usage_count = COALESCE(usage_count, 0) + v_tokens,
      last_used = now()
    WHERE id = NEW.chatbot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger for token tracking
CREATE TRIGGER track_usage_on_chat
  AFTER INSERT OR UPDATE OF tokens_used ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION track_token_usage();

-- Reset usage counts to ensure accuracy
WITH token_sums AS (
  SELECT 
    chatbot_id,
    SUM(tokens_used) as total_tokens,
    MAX(created_at) as last_used
  FROM usage_logs
  GROUP BY chatbot_id
)
UPDATE chatbot_templates ct
SET 
  usage_count = COALESCE(ts.total_tokens, 0),
  last_used = COALESCE(ts.last_used, ct.created_at)
FROM token_sums ts
WHERE ct.id = ts.chatbot_id;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tokens ON chat_sessions(tokens_used);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tokens ON usage_logs(tokens_used);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_usage ON chatbot_templates(usage_count);

-- Update chat_sessions policies to allow anonymous usage
DROP POLICY IF EXISTS "Universal chat session access" ON chat_sessions;
CREATE POLICY "Universal chat session access"
  ON chat_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update usage_logs policies
DROP POLICY IF EXISTS "Anyone can create usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;

CREATE POLICY "Anyone can create usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all usage logs"
  ON usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can view their own usage logs"
  ON usage_logs FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = usage_logs.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );