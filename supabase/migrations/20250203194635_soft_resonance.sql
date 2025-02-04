-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profile access" ON profiles;

-- Create simpler policies
CREATE POLICY "Public profile access"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can manage all profiles"
  ON profiles FOR ALL
  USING (auth.email() = 'admin@admin.de');

-- Update existing admin user if exists
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'
)
WHERE email = 'admin@admin.de';

-- Update profiles table for admin user
UPDATE profiles
SET 
  is_admin = true,
  role = 'admin'::user_role,
  updated_at = now()
WHERE email = 'admin@admin.de';

-- Remove old admin privileges
UPDATE profiles 
SET 
  is_admin = false,
  role = 'teacher'::user_role,
  updated_at = now()
WHERE email = 'schachtschabel@edu-sharing.net';