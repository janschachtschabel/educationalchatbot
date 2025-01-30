-- Add profile fields for teachers
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS institution text,
ADD COLUMN IF NOT EXISTS subjects text[],
ADD COLUMN IF NOT EXISTS education_levels text[],
ADD COLUMN IF NOT EXISTS profile_image text,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

-- Add author name to chatbot templates
ALTER TABLE chatbot_templates
ADD COLUMN IF NOT EXISTS author_name text;

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_author_name ON chatbot_templates (author_name);

-- Update existing chatbots with author names
DO $$ 
BEGIN
  UPDATE chatbot_templates ct
  SET author_name = p.full_name
  FROM profiles p
  WHERE ct.creator_id = p.id
  AND ct.author_name IS NULL;
END $$;