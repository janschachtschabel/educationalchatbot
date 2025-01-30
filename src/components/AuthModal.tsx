import React, { useState } from 'react';
import { X } from 'lucide-react';
import { auth } from '../lib/auth';
import { useLanguageStore } from '../lib/useTranslations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { t } = useLanguageStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const validateForm = () => {
    if (!email.trim() || !password.trim()) {
      setError('Bitte füllen Sie alle Pflichtfelder aus.');
      return false;
    }
    if (isSignUp && !fullName.trim()) {
      setError('Bitte geben Sie Ihren vollständigen Namen ein.');
      return false;
    }
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return false;
    }
    if (!email.includes('@')) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        await auth.signUp(email, password, fullName);
      } else {
        await auth.signIn(email, password);
      }
      onClose();
    } catch (err) {
      console.error('Auth error:', err);
      if (err instanceof Error) {
        if (err.message.includes('already registered')) {
          setError('Diese E-Mail-Adresse wird bereits verwendet.');
        } else if (err.message.includes('Invalid login credentials')) {
          setError('Ungültige E-Mail oder Passwort.');
        } else {
          setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
      } else {
        setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isSignUp ? t.auth.createAccount : t.auth.signIn}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t.auth.fullName}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.auth.email}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.auth.password}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? t.common.loading : (isSignUp ? t.auth.createAccount : t.auth.signIn)}
          </button>

          <p className="text-sm text-gray-600 text-center">
            {isSignUp ? t.auth.alreadyHaveAccount : t.auth.dontHaveAccount}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp ? t.auth.signIn : t.auth.createAccount}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}