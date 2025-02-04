-- Drop existing policies and triggers first
DROP POLICY IF EXISTS "Universal document access" ON chatbot_documents;
DROP TRIGGER IF EXISTS process_document_on_upload ON chatbot_documents;
DROP FUNCTION IF EXISTS process_document_upload();

-- Create simplified document access policy
CREATE POLICY "Universal document access"
  ON chatbot_documents FOR ALL
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_documents.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Create improved document processing function
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
      'Processing document...',
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

-- Create new trigger
CREATE TRIGGER process_document_on_upload
  AFTER INSERT ON chatbot_documents
  FOR EACH ROW
  EXECUTE FUNCTION process_document_upload();

-- Update storage policies
DROP POLICY IF EXISTS "Universal file access" ON storage.objects;

CREATE POLICY "Anyone can access document files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_chatbot_id 
  ON chatbot_documents(chatbot_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id 
  ON document_embeddings(document_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_chatbot_id 
  ON document_embeddings(chatbot_id);

-- Add cascade delete for document embeddings
ALTER TABLE document_embeddings
DROP CONSTRAINT IF EXISTS document_embeddings_document_id_fkey,
ADD CONSTRAINT document_embeddings_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES chatbot_documents(id)
  ON DELETE CASCADE;

ALTER TABLE document_embeddings
DROP CONSTRAINT IF EXISTS document_embeddings_chatbot_id_fkey,
ADD CONSTRAINT document_embeddings_chatbot_id_fkey
  FOREIGN KEY (chatbot_id)
  REFERENCES chatbot_templates(id)
  ON DELETE CASCADE;