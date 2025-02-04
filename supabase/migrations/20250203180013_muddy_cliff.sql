-- Drop existing triggers and functions first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create simpler handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    CASE 
      WHEN NEW.email = 'admin@admin.de' THEN 'admin'::user_role
      ELSE 'teacher'::user_role
    END,
    CASE 
      WHEN NEW.email = 'admin@admin.de' THEN true
      ELSE false
    END,
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

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;

-- Create simpler RLS policies
CREATE POLICY "Public profile access"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can manage all profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@admin.de'
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

UPDATE profiles
SET 
  is_admin = true,
  role = 'admin'::user_role
WHERE email = 'admin@admin.de';