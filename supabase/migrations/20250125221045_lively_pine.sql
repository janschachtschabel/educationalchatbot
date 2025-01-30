/*
  # Add is_blocked column to profiles table

  1. Changes
    - Add is_blocked column to profiles table with default value false
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_blocked'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_blocked boolean DEFAULT false;
  END IF;
END $$;