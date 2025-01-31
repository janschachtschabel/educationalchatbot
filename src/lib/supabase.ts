import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  },
  global: {
    fetch: async (url: string, options: RequestInit) => {
      let lastError;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await window.fetch(url, options);
          
          // Handle auth-specific errors
          if (url.includes('/auth/v1/token')) {
            const data = await response.clone().json();
            if (!response.ok) {
              // Handle session expiry
              if (response.status === 401) {
                window.localStorage.removeItem('supabase-auth');
                window.location.reload();
                return response;
              }
              throw new Error(data.error_description || 'Authentication error');
            }
          }
          
          return response;
        } catch (error) {
          lastError = error;
          const message = error?.message?.toLowerCase() || '';
          const isRetryable = 
            message.includes('fetch') || 
            message.includes('network') ||
            message.includes('connection');
            
          if (attempt < MAX_RETRIES - 1 && isRetryable) {
            await new Promise(resolve => 
              setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt))
            );
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    }
  }
});