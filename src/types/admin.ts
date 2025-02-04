export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_blocked: boolean;
  usage_limit: number | null;
  is_admin: boolean;
}

export interface UsageData {
  date: string;
  tokens: number;
  user_id: string;
  user_name: string;
  chatbot_id: string;
  chatbot_name: string;
}

export interface LLMSettings {
  id: string;
  provider: string;
  model: string;
  base_url: string;
  api_key: string;
  superprompt: string;
}

export interface ChatbotTemplate {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  is_public: boolean;
  is_active: boolean;
  creator_id: string;
  creator_name?: string;
  author_nickname?: string;
}