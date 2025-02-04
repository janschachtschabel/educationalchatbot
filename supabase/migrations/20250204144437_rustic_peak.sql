-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies and triggers
DROP POLICY IF EXISTS "chatbot_policy" ON chatbot_templates;
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;
DROP FUNCTION IF EXISTS set_chatbot_defaults();

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create separate policies for read and write operations
CREATE POLICY "chatbot_read_policy"
  ON chatbot_templates
  FOR SELECT
  TO authenticated
  USING (
    is_public = true OR creator_id = auth.uid()
  );

CREATE POLICY "chatbot_insert_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
  );

CREATE POLICY "chatbot_modify_policy"
  ON chatbot_templates
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid()
  );

CREATE POLICY "chatbot_delete_policy"
  ON chatbot_templates
  FOR DELETE
  TO authenticated
  USING (
    creator_id = auth.uid()
  );

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