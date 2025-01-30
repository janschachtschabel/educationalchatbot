/*
  # Add author nickname to profiles

  1. Changes
    - Add author_nickname column to profiles table
    - Create index for better search performance
    - Add author_nickname to chatbot_templates for display purposes
*/

-- Add author nickname to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS author_nickname text;

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_profiles_author_nickname ON profiles (author_nickname);

-- Add author nickname to chatbot templates if not already present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chatbot_templates' AND column_name = 'author_nickname'
  ) THEN
    ALTER TABLE chatbot_templates ADD COLUMN author_nickname text;
    
    -- Update existing chatbots with author nicknames from profiles
    UPDATE chatbot_templates ct
    SET author_nickname = p.author_nickname
    FROM profiles p
    WHERE ct.creator_id = p.id
    AND ct.author_nickname IS NULL
    AND p.author_nickname IS NOT NULL;
  END IF;
END $$;