-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "universal_access" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create simple read policy for everyone
CREATE POLICY "read_policy"
  ON chatbot_templates
  FOR SELECT
  USING (
    is_public = true OR 
    (auth.uid() IS NOT NULL AND creator_id = auth.uid())
  );

-- Create simple write policy for authenticated users
CREATE POLICY "write_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create simple update/delete policy for owners
CREATE POLICY "modify_policy"
  ON chatbot_templates
  FOR ALL 
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Create simple trigger function
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
CREATE TRIGGER set_chatbot_defaults_trigger
  BEFORE INSERT ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_chatbot_defaults();

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public_active
  ON chatbot_templates(is_public, is_active);