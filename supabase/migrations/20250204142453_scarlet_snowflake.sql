-- Drop existing policies
DROP POLICY IF EXISTS "Creator access" ON chatbot_templates;
DROP POLICY IF EXISTS "Public access" ON chatbot_templates;

-- Create new policies with proper INSERT permissions
CREATE POLICY "Creator access"
  ON chatbot_templates 
  FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Public access"
  ON chatbot_templates 
  FOR SELECT
  USING (is_public = true AND is_active = true);

-- Create policy specifically for INSERT
CREATE POLICY "Allow authenticated users to create chatbots"
  ON chatbot_templates
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    creator_id = auth.uid()
  );

-- Fix any invalid JSONB data
UPDATE chatbot_templates
SET 
  conversation_starters = CASE
    WHEN conversation_starters IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(conversation_starters) = 'array' THEN conversation_starters
    ELSE '[]'::jsonb
  END,
  enabled_tools = CASE
    WHEN enabled_tools IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(enabled_tools) = 'array' THEN enabled_tools
    ELSE '[]'::jsonb
  END;

-- Add or update constraints
ALTER TABLE chatbot_templates
DROP CONSTRAINT IF EXISTS conversation_starters_is_array,
ADD CONSTRAINT conversation_starters_is_array 
  CHECK (jsonb_typeof(conversation_starters) = 'array');

ALTER TABLE chatbot_templates
DROP CONSTRAINT IF EXISTS enabled_tools_is_array,
ADD CONSTRAINT enabled_tools_is_array 
  CHECK (jsonb_typeof(enabled_tools) = 'array');

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id
  ON chatbot_templates(creator_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public_active
  ON chatbot_templates(is_public, is_active);

-- Add function to validate JSONB arrays
CREATE OR REPLACE FUNCTION ensure_jsonb_array(val jsonb)
RETURNS jsonb AS $$
BEGIN
  IF val IS NULL OR jsonb_typeof(val) != 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add trigger to ensure valid JSONB arrays
CREATE OR REPLACE FUNCTION ensure_valid_jsonb_arrays()
RETURNS TRIGGER AS $$
BEGIN
  NEW.conversation_starters := ensure_jsonb_array(NEW.conversation_starters);
  NEW.enabled_tools := ensure_jsonb_array(NEW.enabled_tools);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_valid_jsonb_arrays_trigger ON chatbot_templates;

CREATE TRIGGER ensure_valid_jsonb_arrays_trigger
  BEFORE INSERT OR UPDATE ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION ensure_valid_jsonb_arrays();