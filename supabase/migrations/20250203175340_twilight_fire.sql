-- Create wlo_materials table
CREATE TABLE IF NOT EXISTS wlo_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text,
  preview_url text,
  subject text,
  education_level text[],
  resource_type text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wlo_materials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Creators can manage their WLO materials"
  ON wlo_materials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_materials.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view WLO materials for accessible chatbots"
  ON wlo_materials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_materials.chatbot_id
      AND (
        chatbot_templates.is_public = true
        OR chatbot_templates.creator_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_wlo_materials_chatbot ON wlo_materials (chatbot_id);
CREATE INDEX idx_wlo_materials_subject ON wlo_materials (subject);
CREATE INDEX idx_wlo_materials_type ON wlo_materials (resource_type);
CREATE INDEX idx_wlo_materials_raw_data ON wlo_materials USING gin (raw_data);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_wlo_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
CREATE TRIGGER update_wlo_materials_timestamp
  BEFORE UPDATE ON wlo_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_wlo_materials_updated_at();

-- Add helper function to check if WLO is enabled
CREATE OR REPLACE FUNCTION has_wlo_enabled(chatbot_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chatbot_templates
    WHERE id = chatbot_id
    AND enabled_tools ? 'wlo_resources'
  );
END;
$$ LANGUAGE plpgsql;

-- Add trigger to clean up WLO materials when tool is disabled
CREATE OR REPLACE FUNCTION cleanup_wlo_materials()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT has_wlo_enabled(NEW.id) THEN
    DELETE FROM wlo_materials
    WHERE chatbot_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_wlo_materials_on_update
  AFTER UPDATE ON chatbot_templates
  FOR EACH ROW
  WHEN (OLD.enabled_tools IS DISTINCT FROM NEW.enabled_tools)
  EXECUTE FUNCTION cleanup_wlo_materials();