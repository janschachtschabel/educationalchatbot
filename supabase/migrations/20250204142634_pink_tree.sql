-- First disable RLS to clean up policies
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "authenticated_user_access" ON chatbot_templates;
DROP POLICY IF EXISTS "public_read_access" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Add default values and constraints
ALTER TABLE chatbot_templates 
ALTER COLUMN conversation_starters SET DEFAULT '[]'::jsonb,
ALTER COLUMN enabled_tools SET DEFAULT '[]'::jsonb,
ALTER COLUMN is_public SET DEFAULT false,
ALTER COLUMN is_active SET DEFAULT true;

-- Ensure columns are not null
ALTER TABLE chatbot_templates
ALTER COLUMN conversation_starters SET NOT NULL,
ALTER COLUMN enabled_tools SET NOT NULL,
ALTER COLUMN is_public SET NOT NULL,
ALTER COLUMN is_active SET NOT NULL,
ALTER COLUMN creator_id SET NOT NULL;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies
CREATE POLICY "chatbot_create_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "chatbot_read_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (
    is_public = true OR creator_id = auth.uid()
  );

CREATE POLICY "chatbot_modify_policy"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "chatbot_delete_policy"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Create trigger function for setting defaults and creator_id
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set creator_id from auth context
  NEW.creator_id := auth.uid();
  
  -- Ensure JSONB arrays are valid
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  
  -- Set other defaults
  NEW.is_public := COALESCE(NEW.is_public, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Fix any existing invalid data
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