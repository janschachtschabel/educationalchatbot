-- First drop all dependent triggers and functions
DROP TRIGGER IF EXISTS cleanup_embeddings_on_update ON chatbot_templates;
DROP TRIGGER IF EXISTS process_document_on_upload ON chatbot_documents;
DROP TRIGGER IF EXISTS cleanup_wlo_materials_on_update ON chatbot_templates;
DROP TRIGGER IF EXISTS cleanup_wlo_resources_on_update ON chatbot_templates;

DROP FUNCTION IF EXISTS cleanup_unused_embeddings;
DROP FUNCTION IF EXISTS process_document_upload;
DROP FUNCTION IF EXISTS check_enabled_tools;

-- Create temporary columns with correct type
ALTER TABLE chatbot_templates 
ADD COLUMN enabled_tools_temp jsonb DEFAULT '[]'::jsonb,
ADD COLUMN conversation_starters_temp jsonb DEFAULT '[]'::jsonb;

-- Copy data with proper conversion
UPDATE chatbot_templates
SET 
  enabled_tools_temp = COALESCE(
    CASE 
      WHEN enabled_tools IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(enabled_tools::jsonb) = 'array' THEN enabled_tools::jsonb
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  ),
  conversation_starters_temp = COALESCE(
    CASE 
      WHEN conversation_starters IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(conversation_starters::jsonb) = 'array' THEN conversation_starters::jsonb
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  );

-- Drop old columns
ALTER TABLE chatbot_templates 
DROP COLUMN enabled_tools CASCADE,
DROP COLUMN conversation_starters CASCADE;

-- Rename temp columns to final names
ALTER TABLE chatbot_templates 
RENAME COLUMN enabled_tools_temp TO enabled_tools;

ALTER TABLE chatbot_templates 
RENAME COLUMN conversation_starters_temp TO conversation_starters;

-- Add constraints
ALTER TABLE chatbot_templates
ADD CONSTRAINT enabled_tools_is_array CHECK (jsonb_typeof(enabled_tools) = 'array'),
ADD CONSTRAINT conversation_starters_is_array CHECK (jsonb_typeof(conversation_starters) = 'array');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_enabled_tools 
ON chatbot_templates USING gin (enabled_tools);

CREATE INDEX IF NOT EXISTS idx_chatbot_templates_conversation_starters 
ON chatbot_templates USING gin (conversation_starters);

-- Create helper function for checking enabled tools
CREATE OR REPLACE FUNCTION check_enabled_tools(tools jsonb, tool text)
RETURNS boolean AS $$
BEGIN
  RETURN tools ? tool;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create document processing function
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

-- Create cleanup function
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

-- Create triggers
CREATE TRIGGER cleanup_embeddings_on_update
  AFTER UPDATE ON chatbot_templates
  FOR EACH ROW
  WHEN (OLD.enabled_tools IS DISTINCT FROM NEW.enabled_tools)
  EXECUTE FUNCTION cleanup_unused_embeddings();

CREATE TRIGGER process_document_on_upload
  AFTER INSERT ON chatbot_documents
  FOR EACH ROW
  EXECUTE FUNCTION process_document_upload();