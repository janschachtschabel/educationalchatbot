/*
  # Update chat sessions RLS policies

  1. Changes
    - Add policy for users to create chat sessions
    - Add policy for users to read their own chat sessions
    - Add policy for chatbot creators to read all sessions for their chatbots

  2. Security
    - Users can only create chat sessions for chatbots they have access to
    - Users can read their own chat sessions
    - Chatbot creators can read all sessions for their chatbots
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Creators can view chat sessions" ON chat_sessions;

-- Add user_id column to track session ownership
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_sessions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN user_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Create new policies
CREATE POLICY "Users can create chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE id = chatbot_id AND (
        is_public = true OR
        creator_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can read their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (
    auth.uid() = user_id
  );

CREATE POLICY "Creators can read chatbot sessions"
  ON chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chat_sessions.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );