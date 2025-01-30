/*
  # Add role field to profiles table

  1. Changes
    - Add role column to profiles table with type UserRole (ENUM)
    - Set default role to 'teacher'
    - Add check constraint to ensure valid roles

  2. Security
    - No changes to existing RLS policies
*/

DO $$ 
BEGIN
  -- Create enum type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
  END IF;

  -- Add role column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role user_role NOT NULL DEFAULT 'teacher';
  END IF;
END $$;