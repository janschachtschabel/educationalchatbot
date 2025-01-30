/*
  # Initial Schema Setup for EduBot

  1. New Tables
    - `profiles`
      - Stores additional user information
      - Links to Supabase auth.users
    - `chatbot_templates`
      - Stores chatbot configurations
      - Includes name, description, system prompt, etc.
    - `chatbot_documents`
      - Stores document references for chatbots
    - `chatbot_settings`
      - Stores personal AI settings for teachers
    - `chat_sessions`
      - Stores chat history when enabled
    
  2. Security
    - RLS policies for all tables
    - Teachers can manage their own chatbots
    - Public access for shared templates
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  is_teacher boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chatbot templates table
CREATE TABLE chatbot_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  description text,
  system_prompt text,
  image_url text,
  is_public boolean DEFAULT false,
  can_fork boolean DEFAULT false,
  enabled_tools jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chatbot documents table
CREATE TABLE chatbot_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create personal AI settings table
CREATE TABLE chatbot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  provider text DEFAULT 'open',
  model text DEFAULT 'gpt-4-mini',
  api_key text,
  save_chat_history boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat sessions table
CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id),
  session_id text NOT NULL,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Chatbot templates policies
CREATE POLICY "Creators can manage their templates"
  ON chatbot_templates FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY "Public templates are visible to all"
  ON chatbot_templates FOR SELECT
  USING (is_public = true);

-- Documents policies
CREATE POLICY "Creators can manage their documents"
  ON chatbot_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_documents.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Settings policies
CREATE POLICY "Users can manage their settings"
  ON chatbot_settings FOR ALL
  USING (auth.uid() = user_id);

-- Chat sessions policies
CREATE POLICY "Creators can view chat sessions"
  ON chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chat_sessions.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );