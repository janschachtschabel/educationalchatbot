-- Add properties column to wlo_resources if it doesn't exist
ALTER TABLE wlo_resources
ADD COLUMN IF NOT EXISTS properties jsonb DEFAULT '{}'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_wlo_resources_properties 
  ON wlo_resources USING gin (properties);

-- Add trigger to clean up WLO resources when tool is disabled
CREATE OR REPLACE FUNCTION cleanup_wlo_resources()
RETURNS TRIGGER AS $$
BEGIN
  -- If wlo_resources is removed from enabled_tools
  IF OLD.enabled_tools ? 'wlo_resources' AND NOT NEW.enabled_tools ? 'wlo_resources' THEN
    -- Delete all WLO resources for this chatbot
    DELETE FROM wlo_resources
    WHERE chatbot_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chatbot updates
CREATE TRIGGER cleanup_wlo_resources_on_update
  AFTER UPDATE ON chatbot_templates
  FOR EACH ROW
  WHEN (OLD.enabled_tools IS DISTINCT FROM NEW.enabled_tools)
  EXECUTE FUNCTION cleanup_wlo_resources();