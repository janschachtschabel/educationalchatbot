-- First disable RLS
ALTER TABLE chatbot_passwords DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Creators can manage their chatbot passwords" ON chatbot_passwords;
DROP POLICY IF EXISTS "Anyone can verify passwords" ON chatbot_passwords;

-- Re-enable RLS
ALTER TABLE chatbot_passwords ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "password_management"
  ON chatbot_passwords
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_passwords.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_passwords.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_passwords_chatbot_id
  ON chatbot_passwords(chatbot_id);

-- Add cascade delete
ALTER TABLE chatbot_passwords
DROP CONSTRAINT IF EXISTS chatbot_passwords_chatbot_id_fkey,
ADD CONSTRAINT chatbot_passwords_chatbot_id_fkey
  FOREIGN KEY (chatbot_id)
  REFERENCES chatbot_templates(id)
  ON DELETE CASCADE;