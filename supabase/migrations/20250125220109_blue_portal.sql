/*
  # Add access codes support

  1. New Tables
    - `access_codes`
      - `code` (text, primary key)
      - `chatbot_id` (uuid, references chatbot_templates)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `is_active` (boolean)

  2. Security
    - Enable RLS on `access_codes` table
    - Add policies for creators to manage their codes
    - Add policy for anyone to read active codes
*/

-- Create access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
  code text PRIMARY KEY,
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Access codes policies
CREATE POLICY "Creators can manage their access codes"
  ON access_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = access_codes.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read active access codes"
  ON access_codes FOR SELECT
  USING (is_active = true);