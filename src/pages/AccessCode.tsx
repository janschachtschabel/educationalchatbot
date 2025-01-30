import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowRight, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';

export default function AccessCode() {
  const [code, setCode] = useState('');
  const [chatbotId, setChatbotId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguageStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // If a chatbot ID is provided directly
      if (chatbotId) {
        const { data: chatbot, error: chatbotError } = await supabase
          .from('chatbot_templates')
          .select('id, is_active')
          .eq('id', chatbotId)
          .single();

        if (chatbotError) throw chatbotError;
        if (!chatbot) {
          setError(t.accessCode.invalid);
          return;
        }
        if (!chatbot.is_active) {
          setError(t.accessCode.inactive);
          return;
        }

        navigate(`/chat/${chatbot.id}`);
        return;
      }

      // Otherwise check access code
      if (code.length !== 6) {
        setError(t.accessCode.invalidLength);
        return;
      }

      const { data, error } = await supabase
        .from('access_codes')
        .select('chatbot_id, is_active, expires_at')
        .eq('code', code.toUpperCase())
        .single();

      if (error) throw error;

      if (!data || !data.is_active) {
        setError(t.accessCode.invalid);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError(t.accessCode.expired);
        return;
      }

      // Check if chatbot is active
      const { data: chatbot, error: chatbotError } = await supabase
        .from('chatbot_templates')
        .select('is_active')
        .eq('id', data.chatbot_id)
        .single();

      if (chatbotError) throw chatbotError;
      if (!chatbot?.is_active) {
        setError(t.accessCode.inactive);
        return;
      }

      navigate(`/chat/${data.chatbot_id}`);
    } catch (error) {
      console.error('Error checking access:', error);
      setError(t.accessCode.invalid);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Bot className="h-12 w-12 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t.accessCode.title}
          </h1>
          <p className="text-gray-600">
            {t.accessCode.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.accessCode.label}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="XXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.accessCode.chatbotId}
              </label>
              <input
                type="text"
                value={chatbotId}
                onChange={(e) => setChatbotId(e.target.value)}
                placeholder="Optional: Enter Chatbot ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!code && !chatbotId)}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                t.common.loading
              ) : (
                <>
                  {t.accessCode.submit}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}