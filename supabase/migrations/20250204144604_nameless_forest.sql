-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "chatbot_read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_insert_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_modify_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_delete_policy" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (including anonymous)
CREATE POLICY "public_read_policy"
  ON chatbot_templates
  FOR SELECT
  USING (is_public = true AND is_active = true);

-- Create policy for authenticated users to read their own chatbots
CREATE POLICY "own_read_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- Create policy for admins to read all chatbots
CREATE POLICY "admin_read_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy for authenticated users to create chatbots
CREATE POLICY "create_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy for users to modify their own chatbots
CREATE POLICY "own_modify_policy"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

-- Create policy for admins to modify any chatbot
CREATE POLICY "admin_modify_policy"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy for users to delete their own chatbots
CREATE POLICY "own_delete_policy"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Create policy for admins to delete any chatbot
CREATE POLICY "admin_delete_policy"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create trigger function for setting defaults
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set creator_id to current user if not set
  IF NEW.creator_id IS NULL THEN
    NEW.creator_id := auth.uid();
  END IF;
  
  -- Set default values
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  NEW.is_public := COALESCE(NEW.is_public, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_chatbot_defaults_trigger
  BEFORE INSERT ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_chatbot_defaults();

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public_active
  ON chatbot_templates(is_public, is_active);