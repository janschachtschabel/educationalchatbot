-- Drop existing policies
DROP POLICY IF EXISTS "Creators can manage their WLO resources" ON wlo_resources;
DROP POLICY IF EXISTS "Users can view WLO resources for accessible chatbots" ON wlo_resources;

-- Create new policies with proper permissions
CREATE POLICY "Anyone can manage WLO resources for their chatbots"
  ON wlo_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND (
        chatbot_templates.creator_id = auth.uid()
        OR chatbot_templates.is_public = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Add ON DELETE CASCADE to foreign key if not exists
ALTER TABLE wlo_resources
DROP CONSTRAINT IF EXISTS wlo_resources_chatbot_id_fkey,
ADD CONSTRAINT wlo_resources_chatbot_id_fkey 
  FOREIGN KEY (chatbot_id) 
  REFERENCES chatbot_templates(id) 
  ON DELETE CASCADE;