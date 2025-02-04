-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS track_usage_on_chat ON chat_sessions;
DROP FUNCTION IF EXISTS track_token_usage();

-- Create improved token usage tracking function
CREATE OR REPLACE FUNCTION track_token_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if tokens changed and are greater than 0
  IF (TG_OP = 'INSERT' OR NEW.tokens_used <> OLD.tokens_used) 
     AND NEW.tokens_used > 0 THEN
    
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
      usage_count = usage_count + 1,
      last_used = now()
    WHERE id = NEW.chatbot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger that handles both INSERT and UPDATE
CREATE TRIGGER track_usage_on_chat
  AFTER INSERT OR UPDATE OF tokens_used ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION track_token_usage();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_chatbot_tokens ON usage_logs(chatbot_id, tokens_used);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_tokens ON usage_logs(user_id, tokens_used);

-- Reset usage counts to ensure accuracy
UPDATE chatbot_templates ct
SET usage_count = COALESCE(
  (
    SELECT COUNT(DISTINCT cs.id)
    FROM chat_sessions cs
    WHERE cs.chatbot_id = ct.id
    AND cs.tokens_used > 0
  ),
  0
);

-- Update last_used timestamps
UPDATE chatbot_templates ct
SET last_used = COALESCE(
  (
    SELECT MAX(created_at)
    FROM chat_sessions cs
    WHERE cs.chatbot_id = ct.id
    AND cs.tokens_used > 0
  ),
  ct.created_at
);