-- Add content column to chatbot_documents if it doesn't exist
ALTER TABLE chatbot_documents
ADD COLUMN IF NOT EXISTS content text;

-- Create index for better text search performance
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_content ON chatbot_documents USING gin(to_tsvector('english', COALESCE(content, '')));

-- Update document processing function to store content
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
    -- Create initial placeholder embedding
    INSERT INTO document_embeddings (
      chatbot_id,
      document_id,
      content,
      embedding
    ) VALUES (
      NEW.chatbot_id,
      NEW.id,
      COALESCE(NEW.content, 'Processing document...'),
      NULL
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail the document upload
    RAISE WARNING 'Error in process_document_upload: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;