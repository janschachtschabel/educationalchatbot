import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bot,
  Lock,
  PlayCircle,
  Copy,
  Settings,
  Globe,
  Archive,
  Power,
  Pencil,
  User,
  Building,
  Book,
  GraduationCap,
  Trash2,
  EyeOff,
  Eye,
  Key
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { ChatbotTemplate } from '../lib/types';
import ChatbotPasswordModal from '../components/ChatbotPasswordModal';
import AISettingsModal from '../components/AISettingsModal';
import TeacherProfileForm from '../components/TeacherProfileForm';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const { user } = useAuthStore();
  const [chatbots, setChatbots] = useState<ChatbotTemplate[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotTemplate | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show a temporary success message
    const el = document.getElementById(`copy-success-${text}`);
    if (el) {
      el.classList.remove('opacity-0');
      setTimeout(() => {
        el.classList.add('opacity-0');
      }, 2000);
    }
  };

  async function loadData() {
    try {
      await Promise.all([
        loadChatbots(),
        loadProfile(),
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(t.common.error);
    }
  }

  async function loadChatbots() {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('chatbot_templates')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChatbots(data || []);
    } catch (error) {
      console.error('Error loading chatbots:', error);
      setError(t.common.error);
    }
  }

  async function loadProfile() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }

  async function handleDeleteChatbot(chatbotId: string) {
    if (!window.confirm(t.dashboard.deleteConfirmation)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .delete()
        .eq('id', chatbotId);

      if (error) throw error;
      
      // Refresh the list after deletion
      await loadChatbots();
    } catch (err) {
      console.error('Error deleting chatbot:', err);
      setError(t.common.error);
    }
  }

  async function toggleChatbotStatus(chatbotId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .update({ is_active: !currentStatus })
        .eq('id', chatbotId);

      if (error) throw error;
      await loadChatbots();
    } catch (err) {
      console.error('Error toggling chatbot status:', err);
      setError(t.common.error);
    }
  }

  async function toggleGalleryVisibility(chatbotId: string, currentVisibility: boolean) {
    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .update({ is_public: !currentVisibility })
        .eq('id', chatbotId);

      if (error) throw error;
      await loadChatbots();
    } catch (err) {
      console.error('Error toggling gallery visibility:', err);
      setError(t.common.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      {profile && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                {profile.profile_image ? (
                  <img
                    src={profile.profile_image}
                    alt={profile.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-indigo-600" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
                <p className="text-gray-600">{profile.email}</p>
              </div>
            </div>
            <button
              onClick={() => setShowProfileForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              {t.profile.editProfile}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profile.institution && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <Building className="h-4 w-4" />
                  <span className="font-medium">{t.profile.institution}</span>
                </div>
                <p className="text-gray-900">{profile.institution}</p>
              </div>
            )}

            {profile.subjects?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <Book className="h-4 w-4" />
                  <span className="font-medium">{t.profile.subjects}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.subjects.map((subject: string) => (
                    <span
                      key={subject}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.education_levels?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <GraduationCap className="h-4 w-4" />
                  <span className="font-medium">{t.profile.educationLevels}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.education_levels.map((level: string) => (
                    <span
                      key={level}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      {level}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chatbots Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">{t.dashboard.myChatbots}</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAISettings(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Settings className="h-5 w-5" />
                {t.dashboard.aiSettings}
              </button>
              <button
                onClick={() => navigate('/create-chatbot')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
              >
                {t.dashboard.newChatbot}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chatbots.map((chatbot) => (
              <div key={chatbot.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                {chatbot.image_url ? (
                  <img
                    src={chatbot.image_url}
                    alt={chatbot.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-indigo-50 flex items-center justify-center">
                    <Bot className="h-16 w-16 text-indigo-200" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {chatbot.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* Status Toggle */}
                      <button
                        onClick={() => toggleChatbotStatus(chatbot.id, chatbot.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          chatbot.is_active ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                        title={chatbot.is_active ? t.dashboard.active : t.dashboard.inactive}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            chatbot.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      {/* Gallery Visibility Toggle */}
                      <button
                        onClick={() => toggleGalleryVisibility(chatbot.id, chatbot.is_public)}
                        className={`p-1 rounded-full transition-colors ${
                          chatbot.is_public 
                            ? 'text-indigo-600 hover:bg-indigo-50' 
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={chatbot.is_public ? t.dashboard.publicInGallery : t.dashboard.notInGallery}
                      >
                        {chatbot.is_public ? (
                          <Eye className="h-5 w-5" />
                        ) : (
                          <EyeOff className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">
                    {chatbot.description}
                  </p>

                  {/* Chatbot ID Section */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">ID:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-white px-2 py-1 rounded border">{chatbot.id}</code>
                        <button
                          onClick={() => copyToClipboard(chatbot.id)}
                          className="text-gray-500 hover:text-gray-700"
                          title="Copy ID"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div 
                      id={`copy-success-${chatbot.id}`}
                      className="text-xs text-green-600 mt-1 text-right opacity-0 transition-opacity"
                    >
                      Copied!
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => navigate(`/chat/${chatbot.id}`)}
                      className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {t.common.test}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedChatbot(chatbot);
                        setShowPasswordModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      <Lock className="h-4 w-4" />
                      {t.dashboard.setPassword}
                    </button>
                    <button
                      onClick={() => navigate(`/edit-chatbot/${chatbot.id}`)}
                      className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      {t.common.edit}
                    </button>
                    <button
                      onClick={() => handleDeleteChatbot(chatbot.id)}
                      className="flex items-center justify-center gap-2 bg-white border border-red-300 text-red-700 px-3 py-1.5 rounded text-sm hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t.common.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedChatbot && showPasswordModal && (
        <ChatbotPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          chatbotId={selectedChatbot.id}
          onSuccess={() => {
            setShowPasswordModal(false);
            setSelectedChatbot(null);
          }}
        />
      )}

      <AISettingsModal
        isOpen={showAISettings}
        onClose={() => setShowAISettings(false)}
      />

      {showProfileForm && profile && (
        <TeacherProfileForm
          profile={profile}
          onSave={(updatedProfile) => {
            setProfile(updatedProfile);
            setShowProfileForm(false);
          }}
          onClose={() => setShowProfileForm(false)}
        />
      )}
    </div>
  );
}