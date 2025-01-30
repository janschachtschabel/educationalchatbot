import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Bot, User, Building, Globe, Book, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { TeacherProfile, ChatbotTemplate } from '../lib/types';

export default function AuthorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [chatbots, setChatbots] = useState<ChatbotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Validate ID parameter
    if (!id) {
      setError('Invalid author ID');
      setLoading(false);
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      setError('Invalid author ID format');
      setLoading(false);
      return;
    }

    loadAuthorData();
  }, [id]);

  async function loadAuthorData() {
    if (!id) return;

    try {
      const [profileData, chatbotsData] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('chatbot_templates')
          .select('*')
          .eq('creator_id', id)
          .eq('is_public', true)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ]);

      if (profileData.error) {
        if (profileData.error.code === 'PGRST116') {
          setError('Author not found');
        } else {
          throw profileData.error;
        }
        return;
      }

      if (chatbotsData.error) throw chatbotsData.error;

      setProfile(profileData.data);
      setChatbots(chatbotsData.data || []);
    } catch (err) {
      console.error('Error loading author data:', err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex flex-col items-center">
          <p className="mb-4">{error || t.common.error}</p>
          <button
            onClick={() => navigate('/gallery')}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {t.common.backToGallery}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Author Profile */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4 mb-6">
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
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.author_nickname || profile.full_name}
            </h1>
            {profile.author_nickname && profile.full_name !== profile.author_nickname && (
              <p className="text-gray-600">{profile.full_name}</p>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="mb-6">
            <p className="text-gray-600">{profile.bio}</p>
          </div>
        )}

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

          {profile.website && (
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Globe className="h-4 w-4" />
                <span className="font-medium">{t.profile.website}</span>
              </div>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800"
              >
                {new URL(profile.website).hostname}
              </a>
            </div>
          )}
        </div>

        {(profile.subjects?.length > 0 || profile.education_levels?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
            {profile.subjects?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <Book className="h-4 w-4" />
                  <span className="font-medium">{t.profile.subjects}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.subjects.map((subject) => (
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
                  {profile.education_levels.map((level) => (
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
        )}
      </div>

      {/* Author's Chatbots */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {t.gallery.authorChatbots}
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chatbots.map((chatbot) => (
            <div key={chatbot.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
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
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {chatbot.name}
                  </h3>
                  {chatbot.subject && (
                    <span className="px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full">
                      {chatbot.subject}
                    </span>
                  )}
                </div>
                
                <p className="text-gray-600 mb-4">
                  {chatbot.description}
                </p>

                <Link
                  to={`/chat/${chatbot.id}`}
                  className="block w-full bg-indigo-600 text-white text-center px-4 py-2 rounded-md hover:bg-indigo-700 transition"
                >
                  {t.gallery.startChat}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {chatbots.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t.gallery.noPublicChatbots}
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}