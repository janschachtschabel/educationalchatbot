-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "chatbot_create_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_read_own_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_read_public_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_update_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_delete_policy" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simplified policies that work for both authenticated and anonymous users
CREATE POLICY "allow_read_public_chatbots"
  ON chatbot_templates
  FOR SELECT
  USING (is_public = true AND is_active = true);

CREATE POLICY "allow_read_own_chatbots"
  ON chatbot_templates
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    creator_id = auth.uid()
  );

CREATE POLICY "allow_insert_chatbots"
  ON chatbot_templates
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    creator_id = auth.uid()
  );

CREATE POLICY "allow_update_own_chatbots"
  ON chatbot_templates
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    creator_id = auth.uid()
  );

CREATE POLICY "allow_delete_own_chatbots"
  ON chatbot_templates
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    creator_id = auth.uid()
  );

-- Add proper indexes
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

-- Ensure proper column constraints
ALTER TABLE chatbot_templates
ALTER COLUMN conversation_starters SET NOT NULL,
ALTER COLUMN enabled_tools SET NOT NULL,
ALTER COLUMN is_public SET NOT NULL,
ALTER COLUMN is_active SET NOT NULL;

-- Add trigger function for setting defaults
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set creator_id if not set
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
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;

CREATE TRIGGER set_chatbot_defaults_trigger
  BEFORE INSERT ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_chatbot_defaults();