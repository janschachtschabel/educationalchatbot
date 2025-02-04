-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "public_read" ON chatbot_templates;
DROP POLICY IF EXISTS "authenticated_access" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create two simple policies:
-- 1. Anyone can read public chatbots
CREATE POLICY "read_public"
  ON chatbot_templates
  FOR SELECT
  USING (is_public = true AND is_active = true);

-- 2. Authenticated users can do everything with their own chatbots
CREATE POLICY "authenticated_full_access"
  ON chatbot_templates
  FOR ALL
  TO authenticated
  USING (
    CASE 
      -- For SELECT: allow public or own chatbots
      WHEN current_setting('request.method') = 'GET' 
        THEN is_public = true OR creator_id = auth.uid()
      -- For INSERT: always allow (creator_id will be set by trigger)
      WHEN current_setting('request.method') = 'POST' 
        THEN true
      -- For all other operations: must be owner
      ELSE creator_id = auth.uid()
    END
  )
  WITH CHECK (true);

-- Create simple trigger function
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER AS $$
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