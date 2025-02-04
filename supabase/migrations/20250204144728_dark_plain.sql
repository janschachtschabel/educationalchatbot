-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "public_read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "own_read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "admin_read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "create_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "own_modify_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "admin_modify_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "own_delete_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "admin_delete_policy" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "public_read_policy"
  ON chatbot_templates
  FOR SELECT
  USING (is_public = true AND is_active = true);

CREATE POLICY "own_read_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

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

-- Important: Allow INSERT with NULL creator_id
CREATE POLICY "create_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id IS NULL OR creator_id = auth.uid()
  );

CREATE POLICY "own_modify_policy"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

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

CREATE POLICY "own_delete_policy"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

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

-- Create improved trigger function
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _auth_uid uuid;
BEGIN
  -- Get auth.uid() in security definer context
  SELECT auth.uid() INTO _auth_uid;
  
  -- Set creator_id from auth context
  NEW.creator_id := _auth_uid;
  
  -- Set default values
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  NEW.is_public := COALESCE(NEW.is_public, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  
  RETURN NEW;
END;
$$;

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