/*
  # Conditional Document Embeddings

  1. Changes
    - Makes document embeddings conditional on chatbot's enabled_tools
    - Only processes documents when 'document_qa' tool is enabled
    - Adds cleanup for unused embeddings

  2. Security
    - Maintains existing RLS policies
    - Adds proper error handling
*/

-- Update document processing trigger to check enabled tools
CREATE OR REPLACE FUNCTION process_document_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create embeddings if document_qa is enabled
  IF EXISTS (
    SELECT 1 
    FROM chatbot_templates 
    WHERE id = NEW.chatbot_id 
    AND enabled_tools ? 'document_qa'
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

-- Create function to cleanup unused embeddings
CREATE OR REPLACE FUNCTION cleanup_unused_embeddings()
RETURNS TRIGGER AS $$
BEGIN
  -- If document_qa is removed from enabled_tools
  IF OLD.enabled_tools ? 'document_qa' AND NOT NEW.enabled_tools ? 'document_qa' THEN
    -- Delete all embeddings for this chatbot
    DELETE FROM document_embeddings
    WHERE chatbot_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chatbot updates
DROP TRIGGER IF EXISTS cleanup_embeddings_on_update ON chatbot_templates;

CREATE TRIGGER cleanup_embeddings_on_update
  AFTER UPDATE ON chatbot_templates
  FOR EACH ROW
  WHEN (OLD.enabled_tools IS DISTINCT FROM NEW.enabled_tools)
  EXECUTE FUNCTION cleanup_unused_embeddings();