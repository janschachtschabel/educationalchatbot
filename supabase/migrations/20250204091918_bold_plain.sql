-- Fix usage logs relationships

-- First drop existing foreign key constraints if they exist
ALTER TABLE usage_logs 
DROP CONSTRAINT IF EXISTS usage_logs_chatbot_id_fkey,
DROP CONSTRAINT IF EXISTS usage_logs_user_id_fkey;

-- Add proper foreign key constraints
ALTER TABLE usage_logs
ADD CONSTRAINT usage_logs_chatbot_id_fkey 
  FOREIGN KEY (chatbot_id) 
  REFERENCES chatbot_templates(id) 
  ON DELETE SET NULL;

ALTER TABLE usage_logs
ADD CONSTRAINT usage_logs_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Create indexes for better join performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_chatbot_id ON usage_logs(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Update RLS policies
DROP POLICY IF EXISTS "Anyone can create usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;

CREATE POLICY "Universal usage log creation"
  ON usage_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin usage log access"
  ON usage_logs FOR SELECT
  USING (auth.email() = 'admin@admin.de');

CREATE POLICY "User usage log access"
  ON usage_logs FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = usage_logs.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );