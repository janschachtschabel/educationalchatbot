/*
  # Fix WLO Resources Schema

  1. Changes
    - Add properties column to wlo_resources table to store original WLO metadata
    - Add conversation_starters column to chatbot_templates
  
  2. Notes
    - Properties column stores the complete original WLO resource metadata
    - Conversation starters allow defining up to 4 starter questions
*/

-- Add properties column to wlo_resources if it doesn't exist
ALTER TABLE wlo_resources
ADD COLUMN IF NOT EXISTS properties jsonb;

-- Add conversation_starters to chatbot_templates if it doesn't exist
ALTER TABLE chatbot_templates
ADD COLUMN IF NOT EXISTS conversation_starters text[] DEFAULT ARRAY[]::text[];

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_wlo_resources_properties ON wlo_resources USING gin (properties);