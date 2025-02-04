import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bot,
  Lock,
  Play,
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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { ChatbotTemplate, TeacherProfile } from '../lib/types';
import ChatbotPasswordModal from '../components/ChatbotPasswordModal';
import AISettingsModal from '../components/AISettingsModal';
import TeacherProfileForm from '../components/TeacherProfileForm';
import { useAuthStore } from '../store/authStore';

function Dashboard() {
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const { user } = useAuthStore();
  const [chatbots, setChatbots] = useState<ChatbotTemplate[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotTemplate | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [view, setView] = useState<'all' | 'public' | 'private'>('all');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<TeacherProfile | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, view]);

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
      let query = supabase
        .from('chatbot_templates')
        .select('*, profiles:creator_id (id, full_name, author_nickname)')
        .eq('creator_id', user.id);

      if (view === 'public') {
        query = query.eq('is_public', true);
      } else if (view === 'private') {
        query = query.eq('is_public', false);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to include author information
      const transformedData = data?.map(chatbot => ({
        ...chatbot,
        creator_id: chatbot.profiles?.id,
        creator_name: chatbot.profiles?.full_name || 'Unknown Creator',
        author_nickname: chatbot.profiles?.author_nickname || chatbot.profiles?.full_name || 'Unknown Author'
      })) || [];

      setChatbots(transformedData);
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

  const toggleGalleryVisibility = async (chatbotId: string, isPublic: boolean) => {
    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .update({ is_public: !isPublic })
        .eq('id', chatbotId);

      if (error) throw error;
      loadChatbots();
    } catch (err) {
      console.error('Error toggling gallery visibility:', err);
      setError(t.common.error);
    }
  };

  const toggleActivation = async (chatbotId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('chatbot_templates')
        .update({ is_active: !isActive })
        .eq('id', chatbotId);

      if (error) throw error;
      loadChatbots();
    } catch (err) {
      console.error('Error toggling chatbot activation:', err);
      setError(t.common.error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('ID copied to clipboard!');
  };

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
              <p className="text-gray-600">{profile?.email}</p>
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
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Building className="h-4 w-4" />
              <span className="font-medium">{t.profile.institution}</span>
            </div>
            <p className="text-gray-900">{profile?.institution || '-'}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Book className="h-4 w-4" />
              <span className="font-medium">{t.profile.subjects}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.subjects?.map((subject) => (
                <span
                  key={subject}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                >
                  {subject}
                </span>
              )) || '-'}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <GraduationCap className="h-4 w-4" />
              <span className="font-medium">{t.profile.educationLevels}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile?.education_levels?.map((level) => (
                <span
                  key={level}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {level}
                </span>
              )) || '-'}
            </div>
          </div>
        </div>

        {profile?.bio && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">{profile.bio}</p>
          </div>
        )}
      </div>

      {/* Chatbots Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t.dashboard.myChatbots}</h2>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setView('all')}
                className={`px-3 py-1 rounded-full text-sm ${
                  view === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.dashboard.allTemplates}
              </button>
              <button
                onClick={() => setView('public')}
                className={`px-3 py-1 rounded-full text-sm ${
                  view === 'public'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.dashboard.publicTemplates}
              </button>
              <button
                onClick={() => setView('private')}
                className={`px-3 py-1 rounded-full text-sm ${
                  view === 'private'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.dashboard.privateTemplates}
              </button>
            </div>
          </div>
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chatbots.map((chatbot) => (
            <div key={chatbot.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {chatbot.image_url && (
                <img
                  src={chatbot.image_url}
                  alt={chatbot.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {chatbot.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {chatbot.is_active ? (
                      <Power className="h-4 w-4 text-green-600" title="Active" />
                    ) : (
                      <Power className="h-4 w-4 text-gray-400" title="Inactive" />
                    )}
                    {chatbot.is_public ? (
                      <Globe className="h-4 w-4 text-indigo-600" title="Public in Gallery" />
                    ) : (
                      <Archive className="h-4 w-4 text-gray-400" title="Not in Gallery" />
                    )}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">{chatbot.description}</p>

                <div className="flex items-center gap-2 mb-4 bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-500">ID:</span>
                  <code className="text-sm text-gray-900">{chatbot.id}</code>
                  <button
                    onClick={() => copyToClipboard(chatbot.id)}
                    className="ml-auto text-gray-400 hover:text-gray-600"
                    title="Copy ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => toggleActivation(chatbot.id, chatbot.is_active)}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm ${
                      chatbot.is_active
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Power className="h-4 w-4" />
                    {chatbot.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => toggleGalleryVisibility(chatbot.id, chatbot.is_public)}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm ${
                      chatbot.is_public
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-gray-50 text-gray-700'
                    } hover:bg-opacity-75`}
                  >
                    {chatbot.is_public ? (
                      <>
                        <Globe className="h-4 w-4" />
                        Remove from Gallery
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4" />
                        Add to Gallery
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => navigate(`/chat/${chatbot.id}`)}
                    className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                  >
                    <Play className="h-4 w-4" />
                    Test
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
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
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

export default Dashboard;