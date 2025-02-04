-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_public_read" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_own_read" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_admin_read" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_create" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_own_update" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_admin_update" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_own_delete" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_admin_delete" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "public_read"
  ON chatbot_templates
  FOR SELECT
  USING (is_public = true AND is_active = true);

CREATE POLICY "authenticated_access"
  ON chatbot_templates
  FOR ALL
  TO authenticated
  USING (
    -- For SELECT: can see public or own chatbots
    (current_setting('request.method') = 'GET' AND (is_public = true OR creator_id = auth.uid()))
    OR
    -- For other operations: must be creator
    (current_setting('request.method') != 'GET' AND creator_id = auth.uid())
  )
  WITH CHECK (true);

-- Create trigger function
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set creator_id to current user
  NEW.creator_id := auth.uid();
  
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

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public_active
  ON chatbot_templates(is_public, is_active);