-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "chatbot_create_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_modify_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_delete_policy" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

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
  IF NEW.creator_id IS NULL THEN
    NEW.creator_id := _auth_uid;
  END IF;
  
  -- Ensure JSONB arrays are valid
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  
  -- Set other defaults
  NEW.is_public := COALESCE(NEW.is_public, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  
  RETURN NEW;
END;
$$;

-- Create trigger that runs BEFORE the RLS policies
CREATE TRIGGER set_chatbot_defaults_trigger
  BEFORE INSERT ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create single unified policy for all operations
CREATE POLICY "chatbot_access_policy"
  ON chatbot_templates
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN current_setting('role') = 'rls_bypass' THEN true
      ELSE 
        CASE current_setting('request.method')
          WHEN 'POST' THEN true  -- Allow insert
          WHEN 'GET' THEN is_public OR creator_id = auth.uid()  -- Allow read if public or owner
          ELSE creator_id = auth.uid()  -- For other operations, must be owner
        END
    END
  )
  WITH CHECK (
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN current_setting('role') = 'rls_bypass' THEN true
      ELSE true  -- Allow insert/update if authenticated
    END
  );

-- Add function to bypass RLS for trigger operations
CREATE OR REPLACE FUNCTION bypass_rls() 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
BEGIN
  -- Set custom setting to bypass RLS
  PERFORM set_config('role', 'rls_bypass', true);
END;
$$;

-- Ensure proper column constraints
ALTER TABLE chatbot_templates
ALTER COLUMN conversation_starters SET NOT NULL,
ALTER COLUMN enabled_tools SET NOT NULL,
ALTER COLUMN is_public SET NOT NULL,
ALTER COLUMN is_active SET NOT NULL;

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