import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Bot, BookOpen, X, Key, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { ChatbotTemplate } from '../lib/types';

interface Chatbot extends ChatbotTemplate {
  author_nickname?: string;
  creator_name: string;
  creator_id: string;
}

export default function Gallery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguageStore();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    subject: '',
    level: '',
    author: '',
  });
  const [showDirectAccess, setShowDirectAccess] = useState(false);
  const [directId, setDirectId] = useState(searchParams.get('chatbot') || '');
  const [directPassword, setDirectPassword] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    loadChatbots();
    // Show direct access form if chatbot ID is in URL
    if (searchParams.get('chatbot')) {
      setShowDirectAccess(true);
    }
  }, []);

  async function loadChatbots() {
    try {
      const { data, error } = await supabase
        .from('chatbot_templates')
        .select(`
          *,
          profiles:creator_id (
            id,
            full_name,
            author_nickname
          )
        `)
        .eq('is_public', true)
        .eq('is_active', true);

      if (error) throw error;

      setChatbots(data?.map(chatbot => ({
        ...chatbot,
        creator_id: chatbot.profiles?.id,
        creator_name: chatbot.profiles?.full_name || 'Unknown Creator',
        author_nickname: chatbot.profiles?.author_nickname || chatbot.profiles?.full_name || 'Unknown Author'
      })) || []);
    } catch (err) {
      console.error('Error loading chatbots:', err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }

  const handleDirectAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directId) return;

    setError('');
    setAccessLoading(true);

    try {
      // First check if chatbot exists and is active
      const { data: chatbot, error: chatbotError } = await supabase
        .from('chatbot_templates')
        .select('id, is_active, is_public')
        .eq('id', directId)
        .maybeSingle();

      if (chatbotError) {
        console.error('Chatbot lookup error:', chatbotError);
        throw new Error(t.gallery.invalidId);
      }

      if (!chatbot) {
        throw new Error(t.gallery.invalidId);
      }

      if (!chatbot.is_active) {
        throw new Error(t.gallery.inactiveChatbot);
      }

      // If chatbot is not public, check password
      if (!chatbot.is_public) {
        // First check if password is required
        const { data: pwRequired, error: pwCheckError } = await supabase
          .from('chatbot_passwords')
          .select('id')
          .eq('chatbot_id', directId)
          .eq('is_active', true)
          .maybeSingle();

        if (pwCheckError) {
          console.error('Password check error:', pwCheckError);
          throw new Error(t.common.error);
        }

        // If password is required but not provided
        if (pwRequired && !directPassword) {
          throw new Error(t.gallery.passwordRequired);
        }

        // If password is provided, verify it
        if (directPassword) {
          const { data: pwValid, error: pwValidError } = await supabase
            .from('chatbot_passwords')
            .select('id')
            .eq('chatbot_id', directId)
            .eq('password_hash', directPassword)
            .eq('is_active', true)
            .maybeSingle();

          if (pwValidError) {
            console.error('Password validation error:', pwValidError);
            throw new Error(t.common.error);
          }

          if (!pwValid) {
            throw new Error(t.gallery.invalidPassword);
          }
        }
      }

      // All checks passed, navigate to chat
      navigate(`/chat/${directId}`);
    } catch (err) {
      console.error('Error accessing chatbot:', err);
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAccessLoading(false);
    }
  };

  const filteredChatbots = chatbots.filter(chatbot => {
    const matchesSearch = 
      chatbot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chatbot.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chatbot.author_nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chatbot.creator_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !filters.subject || chatbot.subject === filters.subject;
    const matchesLevel = !filters.level || chatbot.education_level === filters.level;
    const matchesAuthor = !filters.author || 
      chatbot.author_nickname?.toLowerCase().includes(filters.author.toLowerCase()) ||
      chatbot.creator_name.toLowerCase().includes(filters.author.toLowerCase());

    return matchesSearch && matchesSubject && matchesLevel && matchesAuthor;
  });

  const subjects = Array.from(new Set(chatbots.map(c => c.subject).filter(Boolean)));
  const levels = Array.from(new Set(chatbots.map(c => c.education_level).filter(Boolean)));
  const authors = Array.from(new Set(chatbots.map(c => c.author_nickname).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.gallery.title}</h1>
        
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.gallery.searchPlaceholder}
              className="pl-10 pr-4 py-2 w-full md:w-64 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Filter className="h-5 w-5" />
            {t.gallery.filters}
          </button>

          <button
            onClick={() => setShowDirectAccess(!showDirectAccess)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <Key className="h-5 w-5" />
            {t.gallery.directAccess}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.gallery.subject}
              </label>
              <select
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              >
                <option value="">{t.gallery.allSubjects}</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.gallery.educationLevel}
              </label>
              <select
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              >
                <option value="">{t.gallery.allLevels}</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.gallery.author}
              </label>
              <select
                value={filters.author}
                onChange={(e) => setFilters({ ...filters, author: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              >
                <option value="">{t.gallery.allAuthors}</option>
                {authors.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {showDirectAccess && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <form onSubmit={handleDirectAccess} className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.gallery.chatbotId}
                </label>
                <input
                  type="text"
                  value={directId}
                  onChange={(e) => setDirectId(e.target.value)}
                  placeholder={t.gallery.enterChatbotId}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  required
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.gallery.password}
                </label>
                <input
                  type="password"
                  value={directPassword}
                  onChange={(e) => setDirectPassword(e.target.value)}
                  placeholder={t.gallery.optionalPassword}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={accessLoading || !directId}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 min-w-[100px]"
                >
                  {accessLoading ? t.common.loading : t.gallery.access}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse bg-white rounded-lg shadow-md overflow-hidden">
              <div className="h-48 bg-gray-200" />
              <div className="p-6 space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChatbots.map((chatbot) => (
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

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {chatbot.education_level || t.gallery.allLevels}
                  </span>
                  {chatbot.creator_id && (
                    <Link
                      to={`/author/${chatbot.creator_id}`}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                    >
                      <User className="h-4 w-4" />
                      {chatbot.author_nickname}
                    </Link>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/chat/${chatbot.id}`)}
                  className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                >
                  <Bot className="h-5 w-5" />
                  {t.gallery.startChat}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredChatbots.length === 0 && (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t.gallery.noChatbotsFound}
          </h3>
          <p className="text-gray-600">
            {t.gallery.tryAdjustingFilters}
          </p>
        </div>
      )}
    </div>
  );
}