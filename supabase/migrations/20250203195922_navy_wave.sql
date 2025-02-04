-- Drop existing policies
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can read their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Creators can read chatbot sessions" ON chat_sessions;

-- Create new simplified policies
CREATE POLICY "Anyone can create chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read their own sessions"
  ON chat_sessions FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chat_sessions.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);