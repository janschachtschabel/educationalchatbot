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

export const auth = {
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
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
            is_admin: user.email === 'admin@admin.de'
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
      console.error('Error getting current user:', error);
      return null;
    }
  },

  onAuthStateChange(callback: (user: UserProfile | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const user = await this.getCurrentUser();
          callback(user);
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          callback(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        callback(null);
      }
    });
  }
};