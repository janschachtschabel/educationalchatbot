import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Settings,
  BarChart2,
  Grid,
  Shield,
  ArrowLeft,
  Mail,
  User,
  Lock,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../lib/useTranslations';
import UserManagement from '../components/admin/UserManagement';
import LLMSettingsForm from '../components/admin/LLMSettings';
import UsageStats from '../components/admin/UsageStats';
import GalleryManagement from '../components/admin/GalleryManagement';
import { User as UserType, LLMSettings, ChatbotTemplate } from '../types/admin';

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

interface NewUserForm {
  email: string;
  full_name: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
  usage_limit: number | null;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<UserType[]>([]);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [galleryChatbots, setGalleryChatbots] = useState<ChatbotTemplate[]>([]);
  const [llmSettings, setLLMSettings] = useState<LLMSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('7d');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    email: '',
    full_name: '',
    password: '',
    role: 'teacher',
    usage_limit: null
  });
  const [newUserError, setNewUserError] = useState('');

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
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      setLLMSettings(data || {
        id: '',
        provider: 'openai',
        model: 'gpt-4o-mini',
        base_url: 'https://api.openai.com/v1',
        api_key: '',
        superprompt: ''
      });
    } catch (err) {
      console.error('Error loading LLM settings:', err);
      setError(t.common.error);
    }
  }

  async function saveLLMSettings(settings: LLMSettings) {
    try {
      const { data: existingSettings } = await supabase
        .from('admin_settings')
        .select('id')
        .single();

      const settingsData = {
        ...(existingSettings?.id ? { id: existingSettings.id } : {}),
        ...settings,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('admin_settings')
        .upsert(settingsData);

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

  async function createNewUser(e: React.FormEvent) {
    e.preventDefault();
    setNewUserError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          data: {
            full_name: newUserForm.full_name,
            is_admin: newUserForm.role === 'admin'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user data returned');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: newUserForm.role,
          is_admin: newUserForm.role === 'admin',
          usage_limit: newUserForm.usage_limit
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      setShowNewUserModal(false);
      setNewUserForm({
        email: '',
        full_name: '',
        password: '',
        role: 'teacher',
        usage_limit: null
      });
      await loadUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      setNewUserError(
        err instanceof Error 
          ? err.message 
          : 'Error creating user. Please try again.'
      );
    }
  }

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

  const tabs = [
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'llm', icon: Settings, label: 'LLM Settings' },
    { id: 'usage', icon: BarChart2, label: 'Usage Stats' },
    { id: 'gallery', icon: Grid, label: 'Gallery' },
  ];

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
                <UserManagement
                  users={users}
                  onToggleBlock={toggleUserBlock}
                  onUpdateLimit={updateUserLimit}
                  onAddUser={() => setShowNewUserModal(true)}
                />
              )}

              {activeTab === 'llm' && llmSettings && (
                <LLMSettingsForm
                  settings={llmSettings}
                  onSave={saveLLMSettings}
                  providers={PROVIDERS}
                />
              )}

              {activeTab === 'usage' && (
                <UsageStats
                  usageData={usageData}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  onExport={exportUsageData}
                />
              )}

              {activeTab === 'gallery' && (
                <GalleryManagement
                  chatbots={galleryChatbots}
                  onToggleVisibility={toggleChatbotVisibility}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New User Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
              <button
                onClick={() => setShowNewUserModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={createNewUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="inline h-4 w-4 mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline h-4 w-4 mr-2" />
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="inline h-4 w-4 mr-2" />
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Shield className="inline h-4 w-4 mr-2" />
                  Role
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as 'admin' | 'teacher' | 'student' })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <BarChart2 className="inline h-4 w-4 mr-2" />
                  Usage Limit
                </label>
                <select
                  value={newUserForm.usage_limit || 'unlimited'}
                  onChange={(e) => setNewUserForm({
                    ...newUserForm,
                    usage_limit: e.target.value === 'unlimited' ? null : Number(e.target.value)
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="1000">1,000</option>
                  <option value="5000">5,000</option>
                  <option value="10000">10,000</option>
                  <option value="50000">50,000</option>
                </select>
              </div>

              {newUserError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  {newUserError}
                </div>
              )}

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}