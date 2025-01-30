import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Settings,
  Database,
  BarChart2,
  Grid,
  Shield,
  ArrowLeft,
  Lock,
  UserPlus,
  AlertTriangle,
  Check,
  X,
  Save,
  Eye,
  EyeOff,
  Trash2,
  LineChart,
  Calendar,
  Download,
  Bot
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../lib/useTranslations';
import { ChatbotTemplate } from '../lib/types';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_blocked: boolean;
  usage_limit: number | null;
  is_admin: boolean;
}

interface UsageData {
  date: string;
  tokens: number;
  user_id: string;
  user_name: string;
  chatbot_id: string;
  chatbot_name: string;
}

interface LLMSettings {
  id: string;
  provider: string;
  model: string;
  base_url: string;
  api_key: string;
  superprompt: string;
}

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4O Mini (Standard)' },
      { id: 'gpt-4o', name: 'GPT-4O' },
    ],
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B Versatile' },
    ],
  },
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [galleryChatbots, setGalleryChatbots] = useState<ChatbotTemplate[]>([]);
  const [llmSettings, setLLMSettings] = useState<LLMSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [dateRange, setDateRange] = useState('7d'); // '7d', '30d', '90d'

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    loadData();
  }, [user, dateRange]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadUsageData(),
        loadGalleryChatbots(),
        loadLLMSettings(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setUsers(data || []);
  }

  async function loadUsageData() {
    const daysAgo = parseInt(dateRange);
    const { data, error } = await supabase
      .from('usage_logs')
      .select(`
        *,
        profiles:user_id(full_name),
        chatbot_templates:chatbot_id(name)
      `)
      .gte('created_at', new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    setUsageData(data?.map(log => ({
      date: new Date(log.created_at).toLocaleDateString(),
      tokens: log.tokens_used,
      user_id: log.user_id,
      user_name: log.profiles?.full_name || 'Unknown User',
      chatbot_id: log.chatbot_id,
      chatbot_name: log.chatbot_templates?.name || 'Unknown Chatbot'
    })) || []);
  }

  async function loadGalleryChatbots() {
    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setGalleryChatbots(data || []);
  }

  async function loadLLMSettings() {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Set default values if no settings exist
      setLLMSettings(data || {
        id: '',
        provider: 'openai',
        model: 'gpt-4o-mini',
        base_url: PROVIDERS.openai.baseUrl,
        api_key: '',
        superprompt: ''
      });
    } catch (err) {
      console.error('Error loading LLM settings:', err);
      setError(t.common.error);
    }
  }

  async function saveLLMSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!llmSettings) return;

    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          ...llmSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      await loadLLMSettings();
    } catch (err) {
      console.error('Error saving LLM settings:', err);
      setError(t.common.error);
    }
  }

  async function toggleUserBlock(userId: string, isBlocked: boolean) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !isBlocked })
        .eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (err) {
      console.error('Error toggling user block:', err);
      setError(t.common.error);
    }
  }

  async function updateUserLimit(userId: string, limit: number | null) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ usage_limit: limit })
        .eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (err) {
      console.error('Error updating user limit:', err);
      setError(t.common.error);
    }
  }

  async function toggleChatbotVisibility(chatbotId: string, isPublic: boolean) {
    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .update({ is_public: !isPublic })
        .eq('id', chatbotId);

      if (error) throw error;
      await loadGalleryChatbots();
    } catch (err) {
      console.error('Error toggling chatbot visibility:', err);
      setError(t.common.error);
    }
  }

  const tabs = [
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'llm', icon: Settings, label: 'LLM Settings' },
    { id: 'usage', icon: BarChart2, label: 'Usage Stats' },
    { id: 'gallery', icon: Grid, label: 'Gallery' },
  ];

  const exportUsageData = () => {
    const csv = [
      ['Date', 'User', 'Chatbot', 'Tokens Used'].join(','),
      ...usageData.map(log => [
        log.date,
        log.user_name,
        log.chatbot_name,
        log.tokens
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-data-${dateRange}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-600">
                Logged in as Admin
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 ${
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="h-5 w-5" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">
                      User Management
                    </h2>
                    <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition">
                      <UserPlus className="h-5 w-5" />
                      Add User
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usage Limit
                          </th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.full_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.is_admin
                                  ? 'bg-purple-100 text-purple-800'
                                  : user.role === 'teacher'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {user.is_admin ? 'Admin' : user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={user.usage_limit || 'unlimited'}
                                onChange={(e) => updateUserLimit(
                                  user.id,
                                  e.target.value === 'unlimited' ? null : Number(e.target.value)
                                )}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                              >
                                <option value="unlimited">Unlimited</option>
                                <option value="1000">1,000</option>
                                <option value="5000">5,000</option>
                                <option value="10000">10,000</option>
                                <option value="50000">50,000</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.is_blocked
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {user.is_blocked ? (
                                  <>
                                    <X className="h-3 w-3" />
                                    Blocked
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3" />
                                    Active
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => toggleUserBlock(user.id, user.is_blocked)}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
                                  user.is_blocked
                                    ? 'text-green-700 bg-green-50 hover:bg-green-100'
                                    : 'text-red-700 bg-red-50 hover:bg-red-100'
                                }`}
                              >
                                <Lock className="h-4 w-4" />
                                {user.is_blocked ? 'Unblock' : 'Block'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'llm' && llmSettings && (
                <div className="max-w-2xl">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">
                    LLM Provider Settings
                  </h2>

                  <form onSubmit={saveLLMSettings} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Provider
                      </label>
                      <select
                        value={llmSettings.provider}
                        onChange={(e) => {
                          const provider = e.target.value;
                          setLLMSettings({
                            ...llmSettings,
                            provider,
                            base_url: PROVIDERS[provider as keyof typeof PROVIDERS].baseUrl,
                            model: PROVIDERS[provider as keyof typeof PROVIDERS].models[0].id
                          });
                        }}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      >
                        {Object.entries(PROVIDERS).map(([key, provider]) => (
                          <option key={key} value={key}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model
                      </label>
                      <select
                        value={llmSettings.model}
                        onChange={(e) => setLLMSettings({
                          ...llmSettings,
                          model: e.target.value
                        })}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      >
                        {PROVIDERS[llmSettings.provider as keyof typeof PROVIDERS].models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base URL
                      </label>
                      <input
                        type="url"
                        value={llmSettings.base_url}
                        onChange={(e) => setLLMSettings({
                          ...llmSettings,
                          base_url: e.target.value
                        })}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={llmSettings.api_key}
                          onChange={(e) => setLLMSettings({
                            ...llmSettings,
                            api_key: e.target.value
                          })}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showApiKey ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Superprompt
                        <span className="ml-2 text-sm text-gray-500">
                          This will be prepended to all chatbot system prompts
                        </span>
                      </label>
                      <textarea
                        value={llmSettings.superprompt || ''}
                        onChange={(e) => setLLMSettings({
                          ...llmSettings,
                          superprompt: e.target.value
                        })}
                        rows={10}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        placeholder="Enter the superprompt that will be added to all chatbots..."
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
                      >
                        <Save className="h-5 w-5" />
                        Save Settings
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'usage' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-medium text-gray-900">
                        Usage Statistics
                      </h2>
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                      </select>
                    </div>
                    <button
                      onClick={exportUsageData}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LineChart className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-medium text-gray-900">Total Tokens</h3>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">
                          {usageData.reduce((sum, log) => sum + log.tokens, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-medium text-gray-900">Active Users</h3>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">
                          {new Set(usageData.map(log => log.user_id)).size}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-medium text-gray-900">Active Chatbots</h3>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">
                          {new Set(usageData.map(log => log.chatbot_id)).size}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900">Usage Log</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Chatbot
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tokens Used
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {usageData.map((log, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {log.date}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {log.user_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {log.chatbot_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {log.tokens.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'gallery' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">
                      Gallery Management
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {galleryChatbots.map((chatbot) => (
                      <div key={chatbot.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {chatbot.image_url && (
                          <img
                            src={chatbot.image_url}
                            alt={chatbot.name}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <div className="p-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {chatbot.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            {chatbot.description}
                          </p>
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleChatbotVisibility(chatbot.id, chatbot.is_public)}
                              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium ${
                                chatbot.is_public
                                  ? 'text-red-700 bg-red-50 hover:bg-red-100'
                                  : 'text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                            >
                              {chatbot.is_public ? (
                                <>
                                  <EyeOff className="h-4 w-4" />
                                  Hide from Gallery
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4" />
                                  Show in Gallery
                                </>
                              )}
                            </button>
                            <button
                              className="text-gray-400 hover:text-red-600 transition"
                              title="Delete chatbot"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}