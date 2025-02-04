-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "chatbot_access_policy" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create separate policies for better control
CREATE POLICY "chatbot_create_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "chatbot_read_own_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "chatbot_read_public_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (is_public = true AND is_active = true);

CREATE POLICY "chatbot_update_policy"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "chatbot_delete_policy"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Add proper indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public_active
  ON chatbot_templates(is_public, is_active);

-- Fix any invalid data
UPDATE chatbot_templates
SET 
  conversation_starters = COALESCE(conversation_starters, '[]'::jsonb),
  enabled_tools = COALESCE(enabled_tools, '[]'::jsonb),
  is_public = COALESCE(is_public, false),
  is_active = COALESCE(is_active, true)
WHERE 
  conversation_starters IS NULL 
  OR enabled_tools IS NULL
  OR is_public IS NULL
  OR is_active IS NULL;