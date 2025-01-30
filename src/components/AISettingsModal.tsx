import React, { useState, useEffect } from 'react';
import { X, Save, Bot, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { useAuthStore } from '../store/authStore';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UsageStats {
  total_tokens: number;
  active_chatbots: number;
  chatbot_stats: {
    id: string;
    name: string;
    tokens: number;
    is_active: boolean;
  }[];
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const { t } = useLanguageStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [adminSettings, setAdminSettings] = useState<{
    provider: string;
    model: string;
    base_url: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user]);

  async function loadData() {
    try {
      const [usageData, settingsData] = await Promise.all([
        loadUsageStats(),
        loadAdminSettings(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(t.common.error);
    }
  }

  async function loadUsageStats() {
    if (!user) return;

    // First get all chatbots created by the user
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbot_templates')
      .select('id, name, is_active')
      .eq('creator_id', user.id);

    if (chatbotsError) throw chatbotsError;

    // Then get usage data for these chatbots
    const { data: usageData, error: usageError } = await supabase
      .from('usage_logs')
      .select('chatbot_id, tokens_used')
      .in('chatbot_id', chatbots?.map(c => c.id) || []);

    if (usageError) throw usageError;

    // Process usage data
    const stats: UsageStats = {
      total_tokens: 0,
      active_chatbots: 0,
      chatbot_stats: [],
    };

    // Initialize stats for all chatbots
    const chatbotMap = new Map(
      chatbots?.map(chatbot => [
        chatbot.id,
        {
          id: chatbot.id,
          name: chatbot.name,
          tokens: 0,
          is_active: chatbot.is_active,
        }
      ]) || []
    );

    // Add usage data
    usageData?.forEach((log) => {
      if (!chatbotMap.has(log.chatbot_id)) return;
      
      stats.total_tokens += log.tokens_used;
      const chatbotStats = chatbotMap.get(log.chatbot_id);
      if (chatbotStats) {
        chatbotStats.tokens += log.tokens_used;
      }
    });

    stats.chatbot_stats = Array.from(chatbotMap.values());
    stats.active_chatbots = stats.chatbot_stats.filter(c => c.is_active).length;

    setUsageStats(stats);
  }

  async function loadAdminSettings() {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('provider, model, base_url')
        .maybeSingle();

      // If no settings exist yet, don't treat it as an error
      if (error && error.code !== 'PGRST116') throw error;
      
      // Use default settings if none exist
      setAdminSettings(data || {
        provider: 'openai',
        model: 'gpt-4o-mini',
        base_url: 'https://api.openai.com/v1'
      });
    } catch (error) {
      console.error('Error loading admin settings:', error);
      setError(t.common.error);
    }
  }

  async function toggleChatbotStatus(chatbotId: string, isActive: boolean) {
    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .update({ is_active: !isActive })
        .eq('id', chatbotId);

      if (error) throw error;
      await loadUsageStats();
    } catch (err) {
      console.error('Error toggling chatbot status:', err);
      setError(t.common.error);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full p-6 relative">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {t.dashboard.aiSettings}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-8">
          {/* Current LLM Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Current LLM Configuration
              </h3>
            </div>
            {adminSettings ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Provider
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {adminSettings.provider === 'openai' ? 'OpenAI' : 'Groq'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Model
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {adminSettings.model}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Base URL
                  </label>
                  <p className="mt-1 text-sm text-gray-900 truncate">
                    {adminSettings.base_url}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Loading configuration...
              </p>
            )}
          </div>

          {/* Usage Statistics */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <BarChart2 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Usage Statistics
              </h3>
            </div>

            {usageStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm font-medium text-gray-500">
                      Total Tokens Used
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {usageStats.total_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm font-medium text-gray-500">
                      Active Chatbots
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {usageStats.active_chatbots} / {usageStats.chatbot_stats.length}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900">
                      Chatbot Usage
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {usageStats.chatbot_stats.map((chatbot) => (
                      <div
                        key={chatbot.id}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {chatbot.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {chatbot.tokens.toLocaleString()} tokens used
                          </div>
                        </div>
                        <button
                          onClick={() => toggleChatbotStatus(chatbot.id, chatbot.is_active)}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            chatbot.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {chatbot.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading statistics...</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}