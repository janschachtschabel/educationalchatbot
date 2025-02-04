/*
  # Update Admin Email Logic

  1. Changes
    - Updates the admin user email check from schachtschabel@edu-sharing.net to admin@admin.de
    - Ensures the first user with email admin@admin.de becomes admin

  2. Security
    - No changes to existing security policies
    - Only affects admin user assignment logic
*/

-- Update existing admin user if exists
UPDATE profiles 
SET 
  is_admin = false,
  updated_at = now()
WHERE email = 'schachtschabel@edu-sharing.net'
AND is_admin = true;

-- Create function to automatically make first admin@admin.de user an admin
CREATE OR REPLACE FUNCTION make_first_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'admin@admin.de' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE is_admin = true
  ) THEN
    NEW.is_admin := true;
    NEW.role := 'admin'::user_role;
    NEW.usage_limit := null;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS make_first_admin_user_trigger ON profiles;

-- Create trigger for new user registrations
CREATE TRIGGER make_first_admin_user_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION make_first_admin_user();