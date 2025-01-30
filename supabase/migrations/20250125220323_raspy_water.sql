/*
  # Add password protection for chatbots

  1. New Tables
    - `chatbot_passwords`
      - `id` (uuid, primary key)
      - `chatbot_id` (uuid, references chatbot_templates)
      - `password_hash` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `is_active` (boolean)

  2. Security
    - Enable RLS on `chatbot_passwords` table
    - Add policies for creators to manage passwords
    - Add policy for anyone to verify passwords
*/

CREATE TABLE IF NOT EXISTS chatbot_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(chatbot_id)
);

-- Enable RLS
ALTER TABLE chatbot_passwords ENABLE ROW LEVEL SECURITY;

-- Password management policies
CREATE POLICY "Creators can manage their chatbot passwords"
  ON chatbot_passwords FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_passwords.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can verify passwords"
  ON chatbot_passwords FOR SELECT
  USING (is_active = true);

-- Add usage tracking columns to chatbot_templates
ALTER TABLE chatbot_templates 
ADD COLUMN IF NOT EXISTS usage_count bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_used timestamptz;

-- Add function to increment usage count
CREATE OR REPLACE FUNCTION increment_chatbot_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chatbot_templates
  SET 
    usage_count = usage_count + 1,
    last_used = now()
  WHERE id = NEW.chatbot_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chat_sessions
CREATE TRIGGER increment_usage_on_chat
  AFTER INSERT ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION increment_chatbot_usage();