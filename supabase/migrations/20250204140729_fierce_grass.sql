-- Drop existing chatbot template policies
DROP POLICY IF EXISTS "Creators can manage their templates" ON chatbot_templates;
DROP POLICY IF EXISTS "Public templates are visible to all" ON chatbot_templates;
DROP POLICY IF EXISTS "Chatbot creator access" ON chatbot_templates;
DROP POLICY IF EXISTS "Public chatbot access" ON chatbot_templates;

-- Create new simplified chatbot policies
CREATE POLICY "Chatbot template management"
  ON chatbot_templates FOR ALL
  USING (creator_id = auth.uid());

CREATE POLICY "Public chatbot viewing"
  ON chatbot_templates FOR SELECT
  USING (is_public = true);

-- Add proper indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public
  ON chatbot_templates(is_public);

-- Ensure conversation_starters and enabled_tools are proper JSONB arrays
UPDATE chatbot_templates
SET 
  conversation_starters = '[]'::jsonb 
WHERE conversation_starters IS NULL 
   OR jsonb_typeof(conversation_starters) != 'array';

UPDATE chatbot_templates
SET 
  enabled_tools = '[]'::jsonb 
WHERE enabled_tools IS NULL 
   OR jsonb_typeof(enabled_tools) != 'array';

-- Add constraints to ensure proper JSONB array types
ALTER TABLE chatbot_templates
DROP CONSTRAINT IF EXISTS conversation_starters_is_array,
ADD CONSTRAINT conversation_starters_is_array 
  CHECK (jsonb_typeof(conversation_starters) = 'array');

ALTER TABLE chatbot_templates
DROP CONSTRAINT IF EXISTS enabled_tools_is_array,
ADD CONSTRAINT enabled_tools_is_array 
  CHECK (jsonb_typeof(enabled_tools) = 'array');