import { supabase } from './supabase';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_blocked: boolean;
  is_admin: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const auth = {
  async signUp(email: string, password: string, fullName: string) {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('No user data returned');

        // Create profile with default teacher role
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName,
            role: 'teacher',
            is_blocked: false,
            is_admin: false,
          }]);

        if (profileError) throw profileError;

        return authData;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES - 1 && this.isRetryableError(error)) {
          await sleep(RETRY_DELAY * Math.pow(2, attempt));
          continue;
        }
        throw this.normalizeError(error);
      }
    }
    throw lastError;
  },

  async signIn(email: string, password: string) {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES - 1 && this.isRetryableError(error)) {
          await sleep(RETRY_DELAY * Math.pow(2, attempt));
          continue;
        }
        throw this.normalizeError(error);
      }
    }
    throw lastError;
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear any cached data
      window.localStorage.removeItem('supabase-auth');
      window.localStorage.removeItem('auth-storage');
      window.localStorage.removeItem('language-storage');
      
      // Clear any other app-specific storage
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('chat-')) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Force cleanup even if API call fails
      window.localStorage.clear();
      window.location.reload();
    }
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // Try to get existing profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Profile not found, create one
            const newProfile = {
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata.full_name || null,
              role: 'teacher' as UserRole,
              is_blocked: false,
              is_admin: false,
            };

            const { error: insertError } = await supabase
              .from('profiles')
              .insert([newProfile]);

            if (insertError) throw insertError;
            return newProfile;
          }
          throw error;
        }

        return profile as UserProfile;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES - 1 && this.isRetryableError(error)) {
          await sleep(RETRY_DELAY * Math.pow(2, attempt));
          continue;
        }
        throw this.normalizeError(error);
      }
    }
    throw lastError;
  },

  onAuthStateChange(callback: (user: UserProfile | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const user = await this.getCurrentUser();
            callback(user);
          } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            // Clear any cached data
            window.localStorage.removeItem('supabase-auth');
            window.localStorage.removeItem('auth-storage');
            callback(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          if (this.isSessionError(error)) {
            // Force sign out on session errors
            await this.signOut();
          }
          callback(null);
        }
      }
    );

    return subscription;
  },

  isRetryableError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      error?.code === 'NETWORK_ERROR'
    );
  },

  isSessionError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code;
    return (
      message.includes('jwt') ||
      message.includes('token') ||
      code === 'PGRST301' ||
      code === '401'
    );
  },

  normalizeError(error: any): Error {
    const message = error?.message || 'An unknown error occurred';
    
    if (message.includes('User already registered')) {
      return new Error('Diese E-Mail-Adresse wird bereits verwendet');
    }
    
    if (message.includes('Invalid login credentials')) {
      return new Error('Ungültige E-Mail oder Passwort');
    }
    
    if (message.includes('Email not confirmed')) {
      return new Error('Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse');
    }

    if (this.isRetryableError(error)) {
      return new Error('Verbindungsfehler. Bitte versuchen Sie es später erneut');
    }

    return new Error(message);
  }
};