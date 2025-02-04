-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profile access" ON profiles;

-- Create simplified profile policies
CREATE POLICY "Public profile access"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Self profile management"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin profile management"
  ON profiles FOR ALL
  USING (auth.email() = 'admin@admin.de');

-- Drop existing chatbot policies
DROP POLICY IF EXISTS "Creators can manage their templates" ON chatbot_templates;
DROP POLICY IF EXISTS "Public templates are visible to all" ON chatbot_templates;

-- Create simplified chatbot policies
CREATE POLICY "Public chatbot access"
  ON chatbot_templates FOR SELECT
  USING (
    is_public = true 
    OR creator_id = auth.uid()
  );

CREATE POLICY "Creator chatbot management"
  ON chatbot_templates FOR ALL
  USING (creator_id = auth.uid());

-- Create improved user creation function
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
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Update admin user if exists
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'
)
WHERE email = 'admin@admin.de';

-- Update admin profile
UPDATE profiles
SET 
  is_admin = true,
  role = 'admin'::user_role,
  updated_at = now()
WHERE email = 'admin@admin.de';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public ON chatbot_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator ON chatbot_templates(creator_id);