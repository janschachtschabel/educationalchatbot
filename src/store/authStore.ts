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

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      initialized: false,
      error: null,
      checkAuth: async () => {
        set({ loading: true, error: null });
        
        let lastError;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const user = await auth.getCurrentUser();
            set({ user, loading: false, initialized: true, error: null });
            return;
          } catch (error) {
            lastError = error;
            console.error(`Auth check attempt ${attempt + 1} failed:`, error);
            
            if (attempt < MAX_RETRIES - 1 && auth.isRetryableError(error)) {
              await new Promise(resolve => 
                setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt))
              );
              continue;
            }
            
            set({ 
              user: null, 
              loading: false, 
              initialized: true,
              error: auth.isSessionError(error)
                ? 'Session expired. Please sign in again.'
                : 'Unable to connect to authentication service'
            });
            return;
          }
        }
        throw lastError;
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
        // Verify the stored auth state on rehydration
        if (state?.user) {
          auth.getCurrentUser()
            .then(user => {
              if (!user || user.id !== state.user?.id) {
                state.signOut();
              }
            })
            .catch(() => state.signOut());
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

initAuth();