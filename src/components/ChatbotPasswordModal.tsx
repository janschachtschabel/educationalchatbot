import React, { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';

interface ChatbotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatbotId: string;
  onSuccess: () => void;
}

export default function ChatbotPasswordModal({
  isOpen,
  onClose,
  chatbotId,
  onSuccess,
}: ChatbotPasswordModalProps) {
  const { t } = useLanguageStore();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  // Check for existing password
  useEffect(() => {
    if (isOpen && chatbotId) {
      checkExistingPassword();
    }
  }, [isOpen, chatbotId]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  async function checkExistingPassword() {
    try {
      const { data, error } = await supabase
        .from('chatbot_passwords')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setHasExistingPassword(!!data);
    } catch (err) {
      console.error('Error checking password:', err);
      setError(t.common.error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (hasExistingPassword) {
        // Update existing password
        const { error: updateError } = await supabase
          .from('chatbot_passwords')
          .update({
            password_hash: newPassword,
            updated_at: new Date().toISOString()
          })
          .eq('chatbot_id', chatbotId)
          .eq('is_active', true);

        if (updateError) throw updateError;
      } else {
        // Insert new password
        const { error: insertError } = await supabase
          .from('chatbot_passwords')
          .insert({
            chatbot_id: chatbotId,
            password_hash: newPassword,
            is_active: true
          });

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error setting password:', err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {hasExistingPassword ? t.dashboard.updatePassword : t.dashboard.setPassword}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {hasExistingPassword ? t.dashboard.newPassword : t.dashboard.password}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword.trim()}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}