-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "chatbot_read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_insert_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_update_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "chatbot_delete_policy" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create single unified policy for all operations
CREATE POLICY "chatbot_access"
  ON chatbot_templates
  FOR ALL
  USING (
    CASE
      -- Allow read access to public chatbots
      WHEN current_setting('request.method', true) = 'GET' 
        THEN is_public OR auth.uid() = creator_id
      -- For all other operations, must be authenticated
      ELSE auth.uid() IS NOT NULL
    END
  )
  WITH CHECK (
    -- For inserts and updates
    auth.uid() IS NOT NULL
  );

-- Create improved trigger function
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO current_user_id;
  
  -- Set creator_id to current user
  NEW.creator_id := current_user_id;
  
  -- Set default values
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  NEW.is_public := COALESCE(NEW.is_public, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  
  -- Set author name from profile if not provided
  IF NEW.author_name IS NULL THEN
    SELECT full_name INTO NEW.author_name
    FROM profiles
    WHERE id = current_user_id;
  END IF;
  
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