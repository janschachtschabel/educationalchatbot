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
      .insert([
        {
          id: authData.user.id,
          email: authData.user.email,
          full_name: fullName,
          role: 'teacher',
          is_blocked: false,
          is_admin: false,
        },
      ]);

    if (profileError) throw profileError;

    return authData;
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser(): Promise<UserProfile | null> {
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
          console.error('Error fetching profile:', error);
          throw error;
        }

        // If no profile exists, create one with default settings
        if (!profile) {
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

          if (insertError) {
            console.error('Error creating profile:', insertError);
            throw insertError;
          }

          return newProfile;
        }

        return profile as UserProfile;
      } catch (error) {
        console.error(`Auth attempt ${attempt + 1} failed:`, error);
        if (attempt === MAX_RETRIES - 1) throw error;
        await sleep(RETRY_DELAY * Math.pow(2, attempt));
      }
    }
    return null;
  },

  onAuthStateChange(callback: (user: UserProfile | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          try {
            const user = await this.getCurrentUser();
            callback(user);
          } catch (error) {
            console.error('Error getting user profile:', error);
            callback(null);
          }
        } else if (event === 'SIGNED_OUT') {
          callback(null);
        }
      }
    );

    return subscription;
  }
};