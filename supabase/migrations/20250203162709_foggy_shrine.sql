-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Only admins can modify admin settings" ON admin_settings;

-- Create new policies with proper permissions
CREATE POLICY "Anyone can read admin settings"
  ON admin_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage admin settings"
  ON admin_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Ensure default admin settings exist
INSERT INTO admin_settings (
  provider,
  model,
  base_url,
  api_key,
  superprompt,
  created_at,
  updated_at
)
SELECT
  'openai',
  'gpt-4o-mini',
  'https://api.openai.com/v1',
  'sk-demo-key',
  'Du bist ein KI-Assistent für Lehr- und Lernsituationen und gibst sachlich korrekte, verständliche und fachlich fundierte Antworten.',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_settings
);