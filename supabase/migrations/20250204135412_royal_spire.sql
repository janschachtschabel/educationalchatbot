-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can manage WLO resources for their chatbots" ON wlo_resources;

-- Create new simplified policies
CREATE POLICY "Universal WLO resource access"
  ON wlo_resources FOR ALL
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND (
        chatbot_templates.creator_id = auth.uid()
        OR chatbot_templates.is_public = true
      )
    )
  );

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_wlo_resources_chatbot_id 
  ON wlo_resources(chatbot_id);

-- Add cascade delete for WLO resources
ALTER TABLE wlo_resources
DROP CONSTRAINT IF EXISTS wlo_resources_chatbot_id_fkey,
ADD CONSTRAINT wlo_resources_chatbot_id_fkey 
  FOREIGN KEY (chatbot_id) 
  REFERENCES chatbot_templates(id) 
  ON DELETE CASCADE;