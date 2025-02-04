-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile and admins can update all" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "Public profile access"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  USING (
    CASE 
      WHEN auth.jwt() ->> 'email' = 'admin@admin.de' THEN true
      ELSE auth.uid() = id
    END
  );

CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id AND
    auth.email() = email
  );

-- Update handle_new_user function to avoid recursion
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin boolean;
  v_role user_role;
BEGIN
  -- Determine admin status without querying profiles
  IF NEW.email = 'admin@admin.de' THEN
    v_is_admin := true;
    v_role := 'admin'::user_role;
  ELSE
    v_is_admin := false;
    v_role := 'teacher'::user_role;
  END IF;

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
    v_role,
    v_is_admin,
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

-- Create admin check function that doesn't use profiles table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'admin@admin.de';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update other policies that depend on admin status
DROP POLICY IF EXISTS "Admins can manage admin settings" ON admin_settings;
CREATE POLICY "Admins can manage admin settings"
  ON admin_settings
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;
CREATE POLICY "Admins can view all usage logs"
  ON usage_logs
  FOR SELECT
  USING (is_admin());