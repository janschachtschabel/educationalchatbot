-- Drop existing function if it exists
DROP FUNCTION IF EXISTS match_documents;

-- Create improved match_documents function with explicit column references
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
    e.id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM document_embeddings e
  WHERE 
    e.chatbot_id = p_chatbot_id
    AND e.embedding IS NOT NULL  -- Only match documents with valid embeddings
    AND e.content != 'Processing...'  -- Skip documents still being processed
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;