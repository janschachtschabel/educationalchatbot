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
      loading: true, // Start with loading true to show initial loading state
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
            
            // Handle specific auth errors
            if (error?.message?.includes('Invalid refresh token')) {
              await auth.signOut();
              set({ 
                user: null, 
                loading: false, 
                initialized: true,
                error: null // Don't show error to user for normal session expiry
              });
              return;
            }
            
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
                ? null // Don't show error for session issues
                : 'Fehler bei der Authentifizierung'
            });
            return;
          }
        }
        throw lastError;
      },
      signOut: async () => {
        try {
          set({ loading: true });
          await auth.signOut();
          set({ user: null, error: null, loading: false });
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
          state.checkAuth().catch(console.error);
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