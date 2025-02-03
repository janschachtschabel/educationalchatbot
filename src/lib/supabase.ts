import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_TIMEOUT = 10000; // 10 seconds timeout

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
    debug: true, // Enable auth debugging
    onAuthStateChange: (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Clear session data silently
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('supabase-auth');
          window.localStorage.removeItem('auth-storage');
        }
      }
    }
  },
  global: {
    headers: {
      'x-client-info': 'edubot-web'
    },
    fetch: async (url: string, options: RequestInit) => {
      console.log('Supabase request:', url);
      let lastError;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), MAX_TIMEOUT);

          const response = await window.fetch(url, {
            ...options,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));

          // Log response status
          console.log('Supabase response:', url, response.status);

          // Handle auth-specific errors
          if (url.includes('/auth/v1/token')) {
            const data = await response.clone().json();
            if (!response.ok) {
              console.error('Auth error:', data);
              // Handle specific token errors silently
              if (response.status === 400 && data.code === 'refresh_token_not_found') {
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem('supabase-auth');
                  window.localStorage.removeItem('auth-storage');
                }
                return response;
              }
              // Handle session expiry silently
              if (response.status === 401) {
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem('supabase-auth');
                  window.localStorage.removeItem('auth-storage');
                }
                return response;
              }
              throw new Error(data.error_description || 'Authentication error');
            }
          }

          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) {
              console.log('Rate limited, waiting:', retryAfter);
              await new Promise(resolve => 
                setTimeout(resolve, parseInt(retryAfter) * 1000)
              );
              continue;
            }
          }

          return response;
        } catch (error) {
          lastError = error;
          console.error('Supabase request error:', error);
          const message = error?.message?.toLowerCase() || '';
          const isRetryable = 
            message.includes('fetch') || 
            message.includes('network') ||
            message.includes('connection') ||
            message.includes('timeout') ||
            error.name === 'AbortError';

          if (attempt < MAX_RETRIES - 1 && isRetryable) {
            console.log(`Retrying request (${attempt + 1}/${MAX_RETRIES})...`);
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

// Check session validity on page load
const checkSession = async () => {
  if (typeof window === 'undefined') return;

  try {
    console.log('Checking session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('Session check result:', session?.user?.id, error);
    
    if (error || !session) {
      // Clear invalid session data silently
      window.localStorage.removeItem('supabase-auth');
      window.localStorage.removeItem('auth-storage');
    }
  } catch (error) {
    console.error('Session check failed:', error);
    // Clear session on error silently
    window.localStorage.removeItem('supabase-auth');
    window.localStorage.removeItem('auth-storage');
  }
};

// Run session check when the page loads
if (typeof window !== 'undefined') {
  checkSession();
}