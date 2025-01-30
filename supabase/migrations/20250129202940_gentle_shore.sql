/*
  # Add education fields to chatbot templates

  1. Changes
    - Add subject field for categorizing chatbots by subject area
    - Add education_level field for categorizing by education level
    - Add indexes for better query performance
*/

DO $$ 
BEGIN
  -- Add subject column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chatbot_templates' AND column_name = 'subject'
  ) THEN
    ALTER TABLE chatbot_templates ADD COLUMN subject text;
    CREATE INDEX idx_chatbot_templates_subject ON chatbot_templates (subject);
  END IF;

  -- Add education_level column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chatbot_templates' AND column_name = 'education_level'
  ) THEN
    ALTER TABLE chatbot_templates ADD COLUMN education_level text;
    CREATE INDEX idx_chatbot_templates_education_level ON chatbot_templates (education_level);
  END IF;
END $$;