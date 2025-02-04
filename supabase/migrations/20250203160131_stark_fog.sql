/*
  # Fix Profile Table Migration

  1. Changes
    - Properly handles user_role type casting
    - Ensures clean data migration
    - Maintains all existing functionality
    - Fixes type conversion issues

  2. Security
    - Preserves all RLS policies
    - Maintains existing security constraints
*/

-- Ensure user_role type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
  END IF;
END $$;

-- Create new profiles table with proper constraints
CREATE TABLE IF NOT EXISTS profiles_new (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role user_role NOT NULL DEFAULT 'teacher'::user_role,
  is_blocked boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  usage_limit integer,
  bio text,
  website text,
  institution text,
  subjects text[],
  education_levels text[],
  profile_image text,
  social_links jsonb DEFAULT '{}'::jsonb,
  author_nickname text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Copy data with proper type casting
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    INSERT INTO profiles_new (
      id,
      email,
      full_name,
      role,
      is_blocked,
      is_admin,
      usage_limit,
      bio,
      website,
      institution,
      subjects,
      education_levels,
      profile_image,
      social_links,
      author_nickname,
      created_at,
      updated_at
    )
    SELECT 
      id,
      email,
      full_name,
      CASE 
        WHEN is_admin THEN 'admin'::user_role
        ELSE 'teacher'::user_role
      END as role,
      COALESCE(is_blocked, false),
      COALESCE(is_admin, false),
      usage_limit,
      bio,
      website,
      institution,
      subjects,
      education_levels,
      profile_image,
      COALESCE(social_links, '{}'::jsonb),
      author_nickname,
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM profiles
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Drop old table and rename new one
DROP TABLE IF EXISTS profiles CASCADE;
ALTER TABLE IF EXISTS profiles_new RENAME TO profiles;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);
CREATE INDEX IF NOT EXISTS profiles_admin_idx ON profiles (is_admin);

-- Update admin user trigger
CREATE OR REPLACE FUNCTION make_first_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure email is not null
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Email cannot be null';
  END IF;

  -- Make first admin@admin.de user an admin
  IF NEW.email = 'admin@admin.de' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE is_admin = true
  ) THEN
    NEW.is_admin := true;
    NEW.role := 'admin'::user_role;
    NEW.usage_limit := null;
  END IF;

  -- Ensure role is set
  IF NEW.role IS NULL THEN
    NEW.role := 'teacher'::user_role;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle duplicate key gracefully
    RETURN NULL;
  WHEN others THEN
    -- Log error and re-raise
    RAISE NOTICE 'Error in make_first_admin_user: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS make_first_admin_user_trigger ON profiles;

CREATE TRIGGER make_first_admin_user_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION make_first_admin_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id AND
    auth.email() = email
  );

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE 
      WHEN NEW.email = 'admin@admin.de' AND NOT EXISTS (SELECT 1 FROM profiles WHERE is_admin = true)
      THEN 'admin'::user_role
      ELSE 'teacher'::user_role
    END,
    CASE 
      WHEN NEW.email = 'admin@admin.de' AND NOT EXISTS (SELECT 1 FROM profiles WHERE is_admin = true)
      THEN true
      ELSE false
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();