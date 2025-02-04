-- Drop existing policies
DROP POLICY IF EXISTS "Creators can manage their documents" ON chatbot_documents;
DROP POLICY IF EXISTS "Users can view documents for accessible chatbots" ON chatbot_documents;

-- Create new simplified policies
CREATE POLICY "Universal document access"
  ON chatbot_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_documents.chatbot_id
      AND (
        chatbot_templates.creator_id = auth.uid()
        OR chatbot_templates.is_public = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_documents.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Update storage policies
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create simplified storage policies
CREATE POLICY "Universal file access"
  ON storage.objects FOR ALL
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- Add proper foreign key constraint
ALTER TABLE chatbot_documents
DROP CONSTRAINT IF EXISTS chatbot_documents_chatbot_id_fkey,
ADD CONSTRAINT chatbot_documents_chatbot_id_fkey 
  FOREIGN KEY (chatbot_id) 
  REFERENCES chatbot_templates(id) 
  ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_chatbot_id 
  ON chatbot_documents(chatbot_id);

-- Update document processing trigger
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

-- Recreate trigger
DROP TRIGGER IF EXISTS process_document_on_upload ON chatbot_documents;
CREATE TRIGGER process_document_on_upload
  AFTER INSERT ON chatbot_documents
  FOR EACH ROW
  EXECUTE FUNCTION process_document_upload();