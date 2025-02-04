-- Drop existing function if it exists
DROP FUNCTION IF EXISTS match_documents;

-- Create improved match_documents function
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
    AND embedding IS NOT NULL  -- Only match documents with valid embeddings
    AND content != 'Processing...'  -- Skip documents still being processed
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;