-- First drop existing triggers and constraints
DROP TRIGGER IF EXISTS cleanup_embeddings_on_update ON chatbot_templates;
DROP TRIGGER IF EXISTS process_document_on_upload ON chatbot_documents;

-- Create temporary table with correct structure
CREATE TABLE chatbot_templates_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system_prompt text,
  image_url text,
  is_public boolean DEFAULT false,
  can_fork boolean DEFAULT false,
  enabled_tools jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  usage_count bigint DEFAULT 0,
  last_used timestamptz,
  subject text,
  education_level text,
  author_name text,
  author_nickname text,
  is_active boolean DEFAULT true,
  conversation_starters jsonb DEFAULT '[]'::jsonb
);

-- Copy data with conversion
INSERT INTO chatbot_templates_new
SELECT
  id,
  creator_id,
  name,
  description,
  system_prompt,
  image_url,
  is_public,
  can_fork,
  COALESCE(
    CASE 
      WHEN enabled_tools IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(enabled_tools)
    END,
    '[]'::jsonb
  ) as enabled_tools,
  created_at,
  updated_at,
  usage_count,
  last_used,
  subject,
  education_level,
  author_name,
  author_nickname,
  is_active,
  COALESCE(
    CASE 
      WHEN conversation_starters IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(conversation_starters)
    END,
    '[]'::jsonb
  ) as conversation_starters
FROM chatbot_templates;

-- Drop old table and rename new one
DROP TABLE chatbot_templates CASCADE;
ALTER TABLE chatbot_templates_new RENAME TO chatbot_templates;

-- Add constraints
ALTER TABLE chatbot_templates
  ADD CONSTRAINT enabled_tools_is_array CHECK (jsonb_typeof(enabled_tools) = 'array'),
  ADD CONSTRAINT conversation_starters_is_array CHECK (jsonb_typeof(conversation_starters) = 'array');

-- Create indexes
CREATE INDEX idx_chatbot_templates_enabled_tools ON chatbot_templates USING gin (enabled_tools);
CREATE INDEX idx_chatbot_templates_conversation_starters ON chatbot_templates USING gin (conversation_starters);
CREATE INDEX idx_chatbot_templates_creator_id ON chatbot_templates(creator_id);

-- Create helper function
CREATE OR REPLACE FUNCTION check_enabled_tools(tools jsonb, tool text)
RETURNS boolean AS $$
BEGIN
  RETURN tools ? tool;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update triggers
CREATE OR REPLACE FUNCTION process_document_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF check_enabled_tools(
    (SELECT enabled_tools FROM chatbot_templates WHERE id = NEW.chatbot_id),
    'document_qa'
  ) THEN
    INSERT INTO document_embeddings (
      chatbot_id,
      document_id,
      content,
      embedding
    ) VALUES (
      NEW.chatbot_id,
      NEW.id,
      'Processing...',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_unused_embeddings()
RETURNS TRIGGER AS $$
BEGIN
  IF check_enabled_tools(OLD.enabled_tools, 'document_qa') 
     AND NOT check_enabled_tools(NEW.enabled_tools, 'document_qa') THEN
    DELETE FROM document_embeddings
    WHERE chatbot_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER cleanup_embeddings_on_update
  AFTER UPDATE ON chatbot_templates
  FOR EACH ROW
  WHEN (OLD.enabled_tools IS DISTINCT FROM NEW.enabled_tools)
  EXECUTE FUNCTION cleanup_unused_embeddings();

CREATE TRIGGER process_document_on_upload
  AFTER INSERT ON chatbot_documents
  FOR EACH ROW
  EXECUTE FUNCTION process_document_upload();

-- Recreate RLS policies
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage their templates"
  ON chatbot_templates FOR ALL
  USING (creator_id = auth.uid());

CREATE POLICY "Public templates are visible to all"
  ON chatbot_templates FOR SELECT
  USING (is_public = true AND is_active = true);