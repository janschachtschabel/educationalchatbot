-- Drop existing policies and triggers first
DROP POLICY IF EXISTS "Anyone can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can read their own sessions" ON chat_sessions;
DROP TRIGGER IF EXISTS track_usage_on_chat ON chat_sessions;
DROP FUNCTION IF EXISTS track_token_usage();

-- Create simplified chat session policies
CREATE POLICY "Universal chat session access"
  ON chat_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create improved token usage tracking function
CREATE OR REPLACE FUNCTION track_token_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if tokens are greater than 0
  IF NEW.tokens_used > 0 THEN
    -- Insert usage log
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

    -- Update chatbot usage statistics
    UPDATE chatbot_templates
    SET 
      usage_count = COALESCE(usage_count, 0) + 1,
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
  WHEN (NEW.tokens_used > 0)
  EXECUTE FUNCTION track_token_usage();

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tokens ON chat_sessions(tokens_used);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_chatbot_id ON usage_logs(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Add foreign key constraints with proper ON DELETE behavior
ALTER TABLE chat_sessions
DROP CONSTRAINT IF EXISTS chat_sessions_chatbot_id_fkey,
ADD CONSTRAINT chat_sessions_chatbot_id_fkey 
  FOREIGN KEY (chatbot_id) 
  REFERENCES chatbot_templates(id) 
  ON DELETE CASCADE;

ALTER TABLE chat_sessions
DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey,
ADD CONSTRAINT chat_sessions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Reset usage counts to ensure accuracy
UPDATE chatbot_templates ct
SET 
  usage_count = COALESCE((
    SELECT COUNT(DISTINCT cs.id)
    FROM chat_sessions cs
    WHERE cs.chatbot_id = ct.id
    AND cs.tokens_used > 0
  ), 0),
  last_used = COALESCE((
    SELECT MAX(created_at)
    FROM chat_sessions cs
    WHERE cs.chatbot_id = ct.id
    AND cs.tokens_used > 0
  ), ct.created_at);