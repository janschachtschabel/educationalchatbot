-- First disable RLS
ALTER TABLE chatbot_templates DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "read_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "insert_policy" ON chatbot_templates;
DROP POLICY IF EXISTS "modify_policy" ON chatbot_templates;

-- Re-enable RLS
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

-- Create minimal policies
CREATE POLICY "read_policy"
  ON chatbot_templates
  FOR SELECT
  USING (
    is_public = true OR 
    (auth.uid() IS NOT NULL AND creator_id = auth.uid())
  );

CREATE POLICY "insert_policy"
  ON chatbot_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "modify_policy"
  ON chatbot_templates
  FOR ALL
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());