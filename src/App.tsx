import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Bot, LogOut, User, Home, Grid, Shield } from 'lucide-react';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import Gallery from './pages/Gallery';
import ChatInterface from './pages/ChatInterface';
import AccessCode from './pages/AccessCode';
import CreateChatbot from './pages/CreateChatbot';
import EditChatbot from './pages/EditChatbot';
import AdminPanel from './pages/AdminPanel';
import AuthorProfile from './pages/AuthorProfile';
import AuthModal from './components/AuthModal';
import ProtectedRoute from './components/ProtectedRoute';
import LanguageSwitcher from './components/LanguageSwitcher';
import Setup from './pages/Setup';
import { useAuthStore } from './store/authStore';
import { useLanguageStore } from './lib/useTranslations';
import { auth } from './lib/auth';

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading, initialized } = useAuthStore();
  const { t } = useLanguageStore();

  // Initialize auth state
  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        // Initial auth check
        const currentUser = await auth.getCurrentUser();
        useAuthStore.getState().setUser(currentUser);
        
        // Set up auth state change listener
        authSubscription = auth.onAuthStateChange(async (user) => {
          useAuthStore.getState().setUser(user);
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        useAuthStore.getState().setUser(null);
      }
    };

    void initAuth();

    // Cleanup
    return () => {
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  // Show loading state only during initial load
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 text-indigo-600 mx-auto mb-4 animate-bounce" />
          <div className="text-gray-600">{t.common.loading}</div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-8">
                {/* Logo */}
                <Link to="/" className="flex items-center">
                  <Bot className="h-8 w-8 text-indigo-600" />
                  <span className="ml-2 text-2xl font-bold text-gray-900">WLO-Bot</span>
                </Link>

                {/* Navigation Links */}
                <div className="hidden md:flex items-center space-x-4">
                  <Link
                    to="/"
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    <Home className="h-4 w-4" />
                    {t.nav.home}
                  </Link>
                  {user && (
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      <User className="h-4 w-4" />
                      {t.nav.teachers}
                    </Link>
                  )}
                  <Link
                    to="/gallery"
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    <Grid className="h-4 w-4" />
                    {t.nav.gallery}
                  </Link>
                  {user?.is_admin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      <Shield className="h-4 w-4" />
                      {t.nav.admin}
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <LanguageSwitcher />
                {user ? (
                  <>
                    <span className="flex items-center gap-2">
                      <User className="h-5 w-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">{user.full_name}</span>
                    </span>
                    <button
                      onClick={() => useAuthStore.getState().signOut()}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                      <LogOut className="h-5 w-5" />
                      {t.auth.signOut}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
                  >
                    {t.auth.signIn}
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/access" element={<AccessCode />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin={true}>
                <AdminPanel />
              </ProtectedRoute>
            } />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-chatbot"
              element={
                <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                  <CreateChatbot />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-chatbot/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                  <EditChatbot />
                </ProtectedRoute>
              }
            />
            <Route path="/chat/:id" element={<ChatInterface />} />
            <Route path="/author/:id" element={<AuthorProfile />} />
          </Routes>
        </main>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    </Router>
  );
}

export default App;