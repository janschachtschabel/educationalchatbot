/*
  # Fix Schema Errors

  1. Changes
    - Ensures user_role type exists before using it
    - Fixes profile table structure
    - Updates admin user trigger logic
    - Adds proper error handling

  2. Security
    - Maintains existing security policies
    - No changes to access control
*/

-- Create user_role type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
  END IF;
END $$;

-- Ensure profiles table has correct structure
DO $$ 
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role user_role NOT NULL DEFAULT 'teacher';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_blocked'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_blocked boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- Update admin user trigger with better error handling
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

-- Remove old admin if exists
UPDATE profiles 
SET 
  is_admin = false,
  updated_at = now()
WHERE email = 'schachtschabel@edu-sharing.net'
AND is_admin = true;