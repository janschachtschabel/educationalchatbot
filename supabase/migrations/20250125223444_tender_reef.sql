/*
  # Add base_url to chatbot_settings

  1. Changes
    - Add base_url column to chatbot_settings table
    - Set default base_url for OpenAI
  
  2. Notes
    - Uses DO block to check if column exists before adding
    - Sets default value for existing rows
*/

DO $$ 
BEGIN
  -- Add base_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chatbot_settings' AND column_name = 'base_url'
  ) THEN
    ALTER TABLE chatbot_settings ADD COLUMN base_url text;
    
    -- Set default base_url for existing rows
    UPDATE chatbot_settings 
    SET base_url = CASE 
      WHEN provider = 'openai' THEN 'https://api.openai.com/v1'
      WHEN provider = 'groq' THEN 'https://api.groq.com/openai/v1'
      ELSE NULL
    END;
  END IF;
END $$;