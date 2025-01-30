-- Add default admin settings if not exists
INSERT INTO admin_settings (
  provider,
  model,
  base_url,
  api_key,
  created_at,
  updated_at
)
SELECT
  'openai',
  'gpt-4o-mini',
  'https://api.openai.com/v1',
  'sk-demo-key',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_settings
);

-- Ensure admin settings has at most one row
CREATE OR REPLACE FUNCTION ensure_single_admin_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM admin_settings) > 1 THEN
    RAISE EXCEPTION 'Only one row is allowed in admin_settings';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_admin_settings_trigger ON admin_settings;

CREATE TRIGGER ensure_single_admin_settings_trigger
BEFORE INSERT ON admin_settings
FOR EACH ROW
EXECUTE FUNCTION ensure_single_admin_settings();