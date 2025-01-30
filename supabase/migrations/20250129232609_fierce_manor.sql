/*
  # Add WLO Resources Support

  1. New Tables
    - `wlo_resources` - Stores WLO resources linked to chatbots
      - `id` (uuid, primary key)
      - `chatbot_id` (uuid, references chatbot_templates)
      - `title` (text)
      - `description` (text)
      - `url` (text)
      - `preview_url` (text)
      - `subject` (text)
      - `education_level` (text[])
      - `resource_type` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on new tables
    - Add policies for resource management
*/

-- Create wlo_resources table
CREATE TABLE IF NOT EXISTS wlo_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text,
  preview_url text,
  subject text,
  education_level text[],
  resource_type text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wlo_resources ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Creators can manage their WLO resources"
  ON wlo_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view WLO resources for accessible chatbots"
  ON wlo_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND (
        chatbot_templates.is_public = true
        OR chatbot_templates.creator_id = auth.uid()
      )
    )
  );

-- Create indexes
CREATE INDEX idx_wlo_resources_chatbot ON wlo_resources (chatbot_id);
CREATE INDEX idx_wlo_resources_subject ON wlo_resources (subject);
CREATE INDEX idx_wlo_resources_type ON wlo_resources (resource_type);

-- Update system prompt template to include WLO resources
ALTER TABLE chatbot_templates 
ADD COLUMN IF NOT EXISTS wlo_prompt text DEFAULT 'You have access to educational resources from WirLernenOnline. Use these resources to enhance your responses and guide learners to relevant materials when appropriate.';