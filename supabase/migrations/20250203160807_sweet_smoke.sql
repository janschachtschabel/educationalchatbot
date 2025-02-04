/*
  # Add Foreign Key Relationship for Chatbots

  1. Changes
    - Adds proper foreign key constraint between chatbot_templates and profiles
    - Ensures referential integrity
    - Fixes the join query issue in the gallery

  2. Security
    - Maintains existing RLS policies
    - Adds cascading delete for cleanup
*/

-- Add foreign key constraint to chatbot_templates
ALTER TABLE chatbot_templates
DROP CONSTRAINT IF EXISTS chatbot_templates_creator_id_fkey,
ADD CONSTRAINT chatbot_templates_creator_id_fkey 
  FOREIGN KEY (creator_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Create index for better join performance
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id 
  ON chatbot_templates(creator_id);

-- Update RLS policies to use the new relationship
DROP POLICY IF EXISTS "Creators can manage their templates" ON chatbot_templates;
DROP POLICY IF EXISTS "Public templates are visible to all" ON chatbot_templates;

CREATE POLICY "Creators can manage their templates"
  ON chatbot_templates FOR ALL
  USING (creator_id = auth.uid());

CREATE POLICY "Public templates are visible to all"
  ON chatbot_templates FOR SELECT
  USING (is_public = true AND is_active = true);