// Add learning progress types
export interface LearningObjective {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  confidence: number;
}

export interface LearningProgress {
  chatbotId: string;
  sessionId: string;
  objectives: LearningObjective[];
  lastUpdated: string;
}

// Re-export existing types
export type Language = 'de' | 'en';

export interface ChatbotTemplate {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  system_prompt: string;
  image_url: string;
  is_public: boolean;
  can_fork: boolean;
  enabled_tools: string[];
  access_code?: string;
  created_at: string;
  updated_at: string;
  subject?: string;
  education_level?: string;
  author_name?: string;
  author_nickname?: string;
  conversation_starters: string[];
  is_active: boolean;
}

export interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  bio?: string;
  website?: string;
  institution?: string;
  subjects?: FachKey[];
  education_levels?: BildungsstufeKey[];
  profile_image?: string;
  author_nickname?: string;
  social_links?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

// Re-export constants with both German and English names for compatibility
export { BILDUNGSSTUFEN as EDUCATION_LEVELS, FAECHER as SUBJECTS } from './constants';
export { BILDUNGSSTUFEN, FAECHER } from './constants';