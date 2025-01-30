/*
  # Add missing columns and update tables for admin functionality

  1. Changes
    - Add `is_active` column to `chatbot_templates`
    - Add `tokens_used` column to `chat_sessions`

  2. Updates
    - Add trigger for token usage tracking
*/

-- Add is_active column to chatbot_templates if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chatbot_templates' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE chatbot_templates 
    ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add tokens_used column to chat_sessions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_sessions' AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE chat_sessions
    ADD COLUMN tokens_used integer DEFAULT 0;
  END IF;
END $$;

-- Create function to track token usage if not exists
CREATE OR REPLACE FUNCTION track_token_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tokens_used IS NOT NULL AND NEW.tokens_used > 0 THEN
    INSERT INTO usage_logs (
      user_id,
      chatbot_id,
      tokens_used
    ) VALUES (
      NEW.user_id,
      NEW.chatbot_id,
      NEW.tokens_used
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chat_sessions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'track_usage_on_chat'
  ) THEN
    CREATE TRIGGER track_usage_on_chat
      AFTER INSERT OR UPDATE ON chat_sessions
      FOR EACH ROW
      EXECUTE FUNCTION track_token_usage();
  END IF;
END $$;