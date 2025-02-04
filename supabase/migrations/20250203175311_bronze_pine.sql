-- First drop existing triggers and constraints
DROP TRIGGER IF EXISTS cleanup_embeddings_on_update ON chatbot_templates;
DROP TRIGGER IF EXISTS process_document_on_upload ON chatbot_documents;

-- Create new columns with correct types
ALTER TABLE chatbot_templates
ADD COLUMN enabled_tools_new jsonb DEFAULT '[]'::jsonb,
ADD COLUMN conversation_starters_new jsonb DEFAULT '[]'::jsonb;

-- Update new columns with converted data
UPDATE chatbot_templates
SET 
  enabled_tools_new = COALESCE(
    CASE 
      WHEN enabled_tools IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(enabled_tools)
    END,
    '[]'::jsonb
  ),
  conversation_starters_new = COALESCE(
    CASE 
      WHEN conversation_starters IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(conversation_starters)
    END,
    '[]'::jsonb
  );

-- Drop old columns and rename new ones
ALTER TABLE chatbot_templates
DROP COLUMN enabled_tools,
DROP COLUMN conversation_starters;

ALTER TABLE chatbot_templates
RENAME COLUMN enabled_tools_new TO enabled_tools;

ALTER TABLE chatbot_templates
RENAME COLUMN conversation_starters_new TO conversation_starters;

-- Add constraints
ALTER TABLE chatbot_templates
ADD CONSTRAINT enabled_tools_is_array CHECK (jsonb_typeof(enabled_tools) = 'array'),
ADD CONSTRAINT conversation_starters_is_array CHECK (jsonb_typeof(conversation_starters) = 'array');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_enabled_tools ON chatbot_templates USING gin (enabled_tools);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_conversation_starters ON chatbot_templates USING gin (conversation_starters);

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