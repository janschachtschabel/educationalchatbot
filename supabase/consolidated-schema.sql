-- Consolidated schema file for initial setup
-- This file contains the latest state of the database schema
-- Use this for fresh installations, use migrations for updates

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create tables
CREATE TABLE IF NOT EXISTS "conversations" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT,
    user_id UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS "messages" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_roles" (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Set up RLS policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policies for messages
CREATE POLICY "Users can view messages in their conversations"
    ON messages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert messages in their conversations"
    ON messages FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    ));

-- Policies for user_roles
CREATE POLICY "Admin users can manage roles"
    ON user_roles FOR ALL
    USING (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    ));

CREATE POLICY "Users can view own role"
    ON user_roles FOR SELECT
    USING (auth.uid() = user_id);
