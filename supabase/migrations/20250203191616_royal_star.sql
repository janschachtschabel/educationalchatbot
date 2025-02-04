-- Drop existing policies for wlo_resources
DROP POLICY IF EXISTS "Creators can manage their WLO resources" ON wlo_resources;
DROP POLICY IF EXISTS "Users can view WLO resources for accessible chatbots" ON wlo_resources;

-- Create new policies with proper permissions
CREATE POLICY "Creators can manage their WLO resources"
  ON wlo_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view WLO resources for accessible chatbots"
  ON wlo_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND (
        chatbot_templates.is_public = true
        OR chatbot_templates.creator_id = auth.uid()
      )
    )
  );

-- Add foreign key constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'wlo_resources' 
    AND constraint_name = 'wlo_resources_chatbot_id_fkey'
  ) THEN
    ALTER TABLE wlo_resources
    ADD CONSTRAINT wlo_resources_chatbot_id_fkey 
    FOREIGN KEY (chatbot_id) 
    REFERENCES chatbot_templates(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wlo_resources_chatbot_id ON wlo_resources(chatbot_id);