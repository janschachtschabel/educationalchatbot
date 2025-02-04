import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth, UserProfile } from '../lib/auth';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setUser: (user: UserProfile | null) => void;
  checkAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      initialized: false,
      error: null,
      setUser: (user) => set({ user, initialized: true, loading: false }),
      checkAuth: async () => {
        set({ loading: true, error: null });
        try {
          const user = await auth.getCurrentUser();
          set({ user, loading: false, initialized: true, error: null });
        } catch (error) {
          console.error('Auth check error:', error);
          set({ 
            user: null, 
            loading: false, 
            initialized: true,
            error: 'Authentication error'
          });
        }
      },
      signOut: async () => {
        try {
          await auth.signOut();
          set({ user: null, error: null });
        } catch (error) {
          console.error('Sign out error:', error);
          // Force cleanup on error
          window.localStorage.clear();
          window.location.reload();
        }
      },
      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Verify the stored auth state
          state.checkAuth();
        }
      }
    }
  )
);