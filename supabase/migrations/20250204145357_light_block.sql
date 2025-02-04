-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "read_public" ON chatbot_templates;
DROP POLICY IF EXISTS "authenticated_full_access" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "allow_read"
  ON chatbot_templates
  FOR SELECT
  USING (
    is_public = true OR 
    (auth.uid() IS NOT NULL AND creator_id = auth.uid())
  );

CREATE POLICY "allow_insert"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_update"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "allow_delete"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

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
  
  -- Ensure we have a user ID
  IF _auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Always set creator_id to current user, ignoring any provided value
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