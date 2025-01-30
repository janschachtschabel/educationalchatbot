/*
  # Add document embeddings support
  
  1. New Tables
    - `document_embeddings`
      - `id` (uuid, primary key)
      - `chatbot_id` (uuid, references chatbot_templates)
      - `document_id` (uuid, references chatbot_documents)
      - `content` (text)
      - `embedding` (vector)
      - `created_at` (timestamptz)

  2. Functions
    - `match_documents`: Vector similarity search function
    
  3. Security
    - Enable RLS on document_embeddings
    - Add policies for document access
*/

-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  document_id uuid REFERENCES chatbot_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_embeddings_chatbot ON document_embeddings (chatbot_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document ON document_embeddings (document_id);

-- Enable RLS
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Creators can manage their document embeddings"
  ON document_embeddings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = document_embeddings.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can read embeddings for accessible chatbots"
  ON document_embeddings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = document_embeddings.chatbot_id
      AND (
        chatbot_templates.is_public = true
        OR chatbot_templates.creator_id = auth.uid()
      )
    )
  );

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_chatbot_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    1 - (document_embeddings.embedding <=> query_embedding) as similarity
  FROM document_embeddings
  WHERE 
    chatbot_id = p_chatbot_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Update usage_logs policies
DROP POLICY IF EXISTS "Users can create usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;

CREATE POLICY "Users can create usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE id = chatbot_id AND (
        is_public = true OR
        creator_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view their own usage logs"
  ON usage_logs FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = usage_logs.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Add function to process document on upload
CREATE OR REPLACE FUNCTION process_document_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a placeholder embedding to track processing status
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document uploads
DROP TRIGGER IF EXISTS process_document_on_upload ON chatbot_documents;

CREATE TRIGGER process_document_on_upload
  AFTER INSERT ON chatbot_documents
  FOR EACH ROW
  EXECUTE FUNCTION process_document_upload();