-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_read_public_chatbots" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_read_own_chatbots" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_insert_chatbots" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_update_own_chatbots" ON chatbot_templates;
DROP POLICY IF EXISTS "allow_delete_own_chatbots" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "chatbot_read_policy"
  ON chatbot_templates
  FOR SELECT
  USING (
    is_public = true 
    OR (auth.uid() IS NOT NULL AND creator_id = auth.uid())
  );

CREATE POLICY "chatbot_insert_policy"
  ON chatbot_templates
  FOR INSERT
  WITH CHECK (
    -- Allow insert if authenticated and creator_id matches auth.uid()
    -- or if creator_id is NULL (will be set by trigger)
    auth.uid() IS NOT NULL 
    AND (creator_id IS NULL OR creator_id = auth.uid())
  );

CREATE POLICY "chatbot_update_policy"
  ON chatbot_templates
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND creator_id = auth.uid()
  );

CREATE POLICY "chatbot_delete_policy"
  ON chatbot_templates
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL 
    AND creator_id = auth.uid()
  );

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Create improved trigger function
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always set creator_id to current user
  NEW.creator_id := auth.uid();
  
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