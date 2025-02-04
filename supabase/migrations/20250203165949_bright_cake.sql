-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop policies that depend on is_admin() function first
DROP POLICY IF EXISTS "Admins can manage admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can view all usage logs" ON usage_logs;

-- Now we can safely drop the functions
DROP POLICY IF EXISTS "Public profile access" ON profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS is_admin();

-- Create simpler, non-recursive policies
CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can manage all profiles"
  ON profiles FOR ALL
  USING (auth.email() = 'admin@admin.de');

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin boolean;
  v_role user_role;
BEGIN
  -- Set admin status based on email
  IF NEW.email = 'admin@admin.de' THEN
    v_is_admin := true;
    v_role := 'admin'::user_role;
  ELSE
    v_is_admin := false;
    v_role := 'teacher'::user_role;
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (
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
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role,
    v_is_admin,
    now(),
    now()
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Ignore duplicate key violations
    RETURN NEW;
  WHEN others THEN
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Recreate admin settings policies
CREATE POLICY "Admins can manage admin settings"
  ON admin_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Recreate usage logs policies
CREATE POLICY "Admins can view all usage logs"
  ON usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Update existing admin user if needed
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'
)
WHERE email = 'admin@admin.de';