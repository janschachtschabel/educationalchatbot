-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "universal_access" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create single unified policy for all operations
CREATE POLICY "universal_access"
  ON chatbot_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create improved trigger function with proper security context
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
  IF _auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Set default values
  NEW.creator_id := _auth_uid;
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  NEW.is_public := COALESCE(NEW.is_public, false);
  NEW.is_active := COALESCE(NEW.is_active, true);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in set_chatbot_defaults: %', SQLERRM;
END;
$$;

-- Create trigger that runs with elevated privileges
CREATE TRIGGER set_chatbot_defaults_trigger
  BEFORE INSERT ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_chatbot_defaults();

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public_active
  ON chatbot_templates(is_public, is_active);