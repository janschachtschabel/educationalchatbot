/*
  # Update profiles table RLS policies

  1. Changes
    - Add insert policy to allow users to create their own profile
    - Keep existing select and update policies

  2. Security
    - Users can only insert their own profile (id must match auth.uid())
    - Email must match authenticated user's email
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;

-- Recreate policies with proper permissions
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