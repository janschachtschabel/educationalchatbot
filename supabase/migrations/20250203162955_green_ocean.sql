-- Drop existing policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;

-- Create new policies with admin access
CREATE POLICY "Users can view their own profile and admins can view all"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can update their own profile and admins can update all"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id AND
    auth.email() = email
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- Ensure handle_new_user function properly sets email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    CASE 
      WHEN NEW.email = 'admin@admin.de' AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE is_admin = true
      )
      THEN 'admin'::user_role
      ELSE 'teacher'::user_role
    END,
    CASE 
      WHEN NEW.email = 'admin@admin.de' AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE is_admin = true
      )
      THEN true
      ELSE false
    END,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;