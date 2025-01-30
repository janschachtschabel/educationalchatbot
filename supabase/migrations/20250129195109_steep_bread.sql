/*
  # Admin Panel Setup

  1. New Tables
    - `admin_settings`: Central LLM configuration
    - `usage_logs`: Track API usage per user and chatbot
  
  2. Changes
    - Add usage limit and admin flag to profiles
    - Add initial admin user
  
  3. Security
    - Enable RLS on new tables
    - Add policies for admin access
*/

-- Create admin_settings table for central LLM configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  base_url text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create usage_logs table
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  chatbot_id uuid REFERENCES chatbot_templates(id),
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add usage limits to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'usage_limit'
  ) THEN
    ALTER TABLE profiles ADD COLUMN usage_limit integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only admins can manage admin settings"
  ON admin_settings
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

CREATE POLICY "Admins can view all usage logs"
  ON usage_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

CREATE POLICY "Users can view their own usage logs"
  ON usage_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Update or create admin user
DO $$ 
BEGIN
  UPDATE profiles 
  SET 
    is_admin = true,
    usage_limit = null
  WHERE email = 'schachtschabel@edu-sharing.net';

  IF NOT FOUND THEN
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      is_blocked,
      is_admin,
      usage_limit
    )
    VALUES (
      auth.uid(),
      'schachtschabel@edu-sharing.net',
      'System Admin',
      'admin',
      false,
      true,
      null
    );
  END IF;
END $$;