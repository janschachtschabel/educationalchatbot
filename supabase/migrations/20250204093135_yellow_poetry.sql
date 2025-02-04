-- Setup database structure and policies
-- This migration contains the complete database structure for initial setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create user_role type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
  END IF;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text,
  role user_role NOT NULL DEFAULT 'teacher',
  is_blocked boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  usage_limit integer,
  bio text,
  website text,
  institution text,
  subjects text[],
  education_levels text[],
  profile_image text,
  social_links jsonb DEFAULT '{}'::jsonb,
  author_nickname text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chatbot templates table
CREATE TABLE IF NOT EXISTS chatbot_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system_prompt text,
  image_url text,
  is_public boolean DEFAULT false,
  can_fork boolean DEFAULT false,
  enabled_tools jsonb DEFAULT '[]'::jsonb,
  conversation_starters jsonb DEFAULT '[]'::jsonb,
  subject text,
  education_level text,
  author_name text,
  author_nickname text,
  is_active boolean DEFAULT true,
  usage_count bigint DEFAULT 0,
  last_used timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT enabled_tools_is_array CHECK (jsonb_typeof(enabled_tools) = 'array'),
  CONSTRAINT conversation_starters_is_array CHECK (jsonb_typeof(conversation_starters) = 'array')
);

-- Create chatbot documents table
CREATE TABLE IF NOT EXISTS chatbot_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create document embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  document_id uuid REFERENCES chatbot_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Create chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  messages jsonb DEFAULT '[]'::jsonb,
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create usage logs table
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  chatbot_id uuid REFERENCES chatbot_templates(id) ON DELETE SET NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  base_url text NOT NULL,
  api_key text NOT NULL,
  superprompt text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create WLO resources table
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
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_creator_id ON chatbot_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_public ON chatbot_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_enabled_tools ON chatbot_templates USING gin(enabled_tools);
CREATE INDEX IF NOT EXISTS idx_chatbot_templates_conversation_starters ON chatbot_templates USING gin(conversation_starters);
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_chatbot_id ON chatbot_documents(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_content ON chatbot_documents USING gin(to_tsvector('english', COALESCE(content, '')));
CREATE INDEX IF NOT EXISTS idx_chatbot_documents_metadata ON chatbot_documents USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_chatbot_id ON document_embeddings(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_chatbot_id ON usage_logs(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_wlo_resources_chatbot_id ON wlo_resources(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_wlo_resources_properties ON wlo_resources USING gin(properties);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wlo_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles
CREATE POLICY "Public profile access"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Self profile management"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin profile management"
  ON profiles FOR ALL
  USING (auth.email() = 'admin@admin.de');

-- Chatbot templates
CREATE POLICY "Public chatbot access"
  ON chatbot_templates FOR SELECT
  USING (
    is_public = true 
    OR creator_id = auth.uid()
  );

CREATE POLICY "Creator chatbot management"
  ON chatbot_templates FOR ALL
  USING (creator_id = auth.uid());

-- Documents
CREATE POLICY "Anyone can read documents"
  ON chatbot_documents FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage documents"
  ON chatbot_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = chatbot_documents.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Document embeddings
CREATE POLICY "Anyone can read embeddings"
  ON document_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage embeddings"
  ON document_embeddings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = document_embeddings.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Chat sessions
CREATE POLICY "Universal chat session access"
  ON chat_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Usage logs
CREATE POLICY "Universal usage log creation"
  ON usage_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin usage log access"
  ON usage_logs FOR SELECT
  USING (auth.email() = 'admin@admin.de');

CREATE POLICY "User usage log access"
  ON usage_logs FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = usage_logs.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Admin settings
CREATE POLICY "Anyone can read admin settings"
  ON admin_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage admin settings"
  ON admin_settings FOR ALL
  USING (auth.email() = 'admin@admin.de');

-- WLO resources
CREATE POLICY "Anyone can manage WLO resources for their chatbots"
  ON wlo_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND (
        chatbot_templates.creator_id = auth.uid()
        OR chatbot_templates.is_public = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbot_templates
      WHERE chatbot_templates.id = wlo_resources.chatbot_id
      AND chatbot_templates.creator_id = auth.uid()
    )
  );

-- Create helper functions
CREATE OR REPLACE FUNCTION check_enabled_tools(tools jsonb, tool text)
RETURNS boolean AS $$
BEGIN
  RETURN tools ? tool;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create triggers
CREATE OR REPLACE FUNCTION process_document_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF check_enabled_tools(
    (SELECT enabled_tools FROM chatbot_templates WHERE id = NEW.chatbot_id),
    'document_qa'
  ) THEN
    INSERT INTO document_embeddings (
      chatbot_id,
      document_id,
      content,
      embedding
    ) VALUES (
      NEW.chatbot_id,
      NEW.id,
      COALESCE(NEW.content, 'Processing document...'),
      NULL
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error in process_document_upload: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_document_on_upload
  AFTER INSERT ON chatbot_documents
  FOR EACH ROW
  EXECUTE FUNCTION process_document_upload();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE 
      WHEN NEW.email = 'admin@admin.de' THEN 'admin'::user_role
      ELSE 'teacher'::user_role
    END,
    CASE 
      WHEN NEW.email = 'admin@admin.de' THEN true
      ELSE false
    END,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
  WHEN others THEN
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can access document files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- Insert default admin settings
INSERT INTO admin_settings (
  provider,
  model,
  base_url,
  api_key,
  superprompt,
  created_at,
  updated_at
)
SELECT
  'openai',
  'gpt-4o-mini',
  'https://api.openai.com/v1',
  'sk-demo-key',
  'Du bist ein KI-Assistent für Lehr- und Lernsituationen und gibst sachlich korrekte, verständliche und fachlich fundierte Antworten.',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_settings
);