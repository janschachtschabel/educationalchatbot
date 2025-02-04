-- First drop all existing policies
DROP POLICY IF EXISTS "Creator access" ON chatbot_templates;
DROP POLICY IF EXISTS "Public access" ON chatbot_templates;
DROP POLICY IF EXISTS "Allow authenticated users to create chatbots" ON chatbot_templates;

-- Create a single unified policy for authenticated users
CREATE POLICY "authenticated_user_access"
  ON chatbot_templates
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    -- Can view public chatbots or own chatbots
    is_public = true OR creator_id = auth.uid()
  )
  WITH CHECK (
    -- Can only modify own chatbots
    creator_id = auth.uid()
  );

-- Create policy for public read access
CREATE POLICY "public_read_access"
  ON chatbot_templates
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    is_public = true AND is_active = true
  );

-- Ensure default values for JSONB columns
ALTER TABLE chatbot_templates 
ALTER COLUMN conversation_starters SET DEFAULT '[]'::jsonb,
ALTER COLUMN enabled_tools SET DEFAULT '[]'::jsonb;

-- Add NOT NULL constraints
ALTER TABLE chatbot_templates
ALTER COLUMN conversation_starters SET NOT NULL,
ALTER COLUMN enabled_tools SET NOT NULL;

-- Add array type constraints
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

-- Add trigger function for default values
CREATE OR REPLACE FUNCTION set_chatbot_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default values for JSONB arrays if NULL
  NEW.conversation_starters := COALESCE(NEW.conversation_starters, '[]'::jsonb);
  NEW.enabled_tools := COALESCE(NEW.enabled_tools, '[]'::jsonb);
  
  -- Ensure arrays are valid
  IF jsonb_typeof(NEW.conversation_starters) != 'array' THEN
    NEW.conversation_starters := '[]'::jsonb;
  END IF;
  
  IF jsonb_typeof(NEW.enabled_tools) != 'array' THEN
    NEW.enabled_tools := '[]'::jsonb;
  END IF;

  -- Set creator_id if not set
  IF NEW.creator_id IS NULL THEN
    NEW.creator_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_chatbot_defaults_trigger ON chatbot_templates;

CREATE TRIGGER set_chatbot_defaults_trigger
  BEFORE INSERT OR UPDATE ON chatbot_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_chatbot_defaults();