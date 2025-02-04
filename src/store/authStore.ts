import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth, UserProfile } from '../lib/auth';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
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
          // Verify the stored auth state immediately after rehydration
          state.checkAuth();
        }
      }
    }
  )
);

// Initialize auth state and set up auth state change listener
let authSubscription: { unsubscribe: () => void } | null = null;

const initAuth = async () => {
  // Clean up existing subscription
  if (authSubscription?.unsubscribe) {
    authSubscription.unsubscribe();
  }

  // Initial auth check
  await useAuthStore.getState().checkAuth();
  
  // Set up new subscription
  authSubscription = auth.onAuthStateChange(async (user) => {
    useAuthStore.setState({ 
      user, 
      loading: false, 
      initialized: true, 
      error: null 
    });
  });

  // Clean up on window unload
  window.addEventListener('unload', () => {
    if (authSubscription?.unsubscribe) {
      authSubscription.unsubscribe();
    }
  });
};

// Initialize auth immediately
initAuth();