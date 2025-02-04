import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Image, FileText, X, Upload, Book } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import ToolManager from '../components/ToolManager';
import DocumentUploadArea from '../components/DocumentUploadArea';
import { useAuthStore } from '../store/authStore';
import WikimediaImagePicker from '../components/WikimediaImagePicker';
import WLOResourceSearch from '../components/WLOResourceSearch';
import { SUBJECTS, EDUCATION_LEVELS } from '../lib/types';

export default function CreateChatbot() {
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: string; filename: string; created_at: string }>>([]);
  const [wloResources, setWloResources] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    imageUrl: '',
    enabledTools: [] as string[],
    subject: '',
    educationLevel: '',
    conversationStarters: ['', '', '', '']
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('chatbot_templates')
        .insert([
          {
            creator_id: user.id,
            name: formData.name,
            description: formData.description,
            system_prompt: formData.systemPrompt,
            image_url: formData.imageUrl,
            enabled_tools: formData.enabledTools,
            subject: formData.subject || null,
            education_level: formData.educationLevel || null,
            is_active: true,
            is_public: false,
            author_name: user.full_name,
            conversation_starters: formData.conversationStarters.filter(s => s.trim()),
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error('No data returned');

      // Save WLO resources if any are selected
      if (wloResources.length > 0) {
        const { error: wloError } = await supabase
          .from('wlo_resources')
          .insert(
            wloResources.map(resource => ({
              chatbot_id: data.id,
              title: resource.name || resource.properties?.['cclom:title']?.[0] || 'Untitled',
              description: resource.properties?.['cclom:general_description']?.[0] || '',
              url: resource.properties?.['ccm:wwwurl']?.[0] || '',
              preview_url: resource.preview?.url || null,
              subject: resource.properties?.['ccm:taxonid_DISPLAYNAME']?.[0] || null,
              education_level: resource.properties?.['ccm:educationalcontext_DISPLAYNAME'] || [],
              resource_type: resource.properties?.['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0] || null,
              properties: resource.properties
            }))
          );

        if (wloError) throw wloError;
      }

      setChatbotId(data.id);
      setShowUpload(true);
      loadDocuments(data.id);
    } catch (err) {
      console.error('Error creating chatbot:', err);
      setError(t.common.error);
      setLoading(false);
    }
  };

  const loadDocuments = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('chatbot_documents')
        .select('id, filename, created_at')
        .eq('chatbot_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!chatbotId) return;
    
    try {
      const { error } = await supabase
        .from('chatbot_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      await loadDocuments(chatbotId);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(t.common.error);
    }
  };

  const showDocumentUpload = formData.enabledTools.includes('document_qa');
  const showWloResources = formData.enabledTools.includes('wlo_resources');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {t.dashboard.createChatbot}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="flex items-center gap-3 text-lg font-medium text-gray-900">
            <Bot className="h-6 w-6 text-indigo-600" />
            {t.dashboard.chatbotName}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.dashboard.chatbotName}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.dashboard.description}
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.dashboard.systemPrompt}
              </label>
              <textarea
                required
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                rows={5}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                placeholder="You are a helpful teaching assistant..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.dashboard.imageUrl}
              </label>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  placeholder="https://example.com/image.jpg"
                />
                <button
                  type="button"
                  onClick={() => setShowImagePicker(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Image className="h-5 w-5" />
                  {t.dashboard.selectImage}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.dashboard.subject}
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="">{t.gallery.allSubjects}</option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.dashboard.educationLevel}
                </label>
                <select
                  value={formData.educationLevel}
                  onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="">{t.gallery.allLevels}</option>
                  {EDUCATION_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                {t.dashboard.conversationStarters}
                <span className="ml-2 text-sm text-gray-500">
                  {t.dashboard.conversationStartersHelp}
                </span>
              </label>
              <div className="space-y-3">
                {formData.conversationStarters.map((starter, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-grow">
                      <input
                        type="text"
                        value={starter}
                        onChange={(e) => {
                          const newStarters = [...formData.conversationStarters];
                          newStarters[index] = e.target.value;
                          setFormData({ ...formData, conversationStarters: newStarters });
                        }}
                        placeholder={`${t.dashboard.conversationStarter} ${index + 1}`}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <ToolManager
            enabledTools={formData.enabledTools}
            onChange={(tools) => setFormData({ ...formData, enabledTools: tools })}
          />
        </div>

        {showDocumentUpload && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-indigo-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  {t.dashboard.documents}
                </h2>
              </div>
              {chatbotId && (
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                >
                  <Upload className="h-5 w-5" />
                  {t.dashboard.uploadDocument}
                </button>
              )}
            </div>

            {chatbotId && showUpload && (
              <DocumentUploadArea
                chatbotId={chatbotId}
                onUploadComplete={() => {
                  setShowUpload(false);
                  loadDocuments(chatbotId);
                }}
              />
            )}

            {documents.length > 0 && (
              <div className="border rounded-lg divide-y">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showWloResources && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-6">
              <Book className="h-6 w-6 text-indigo-600" />
              <h2 className="text-lg font-medium text-gray-900">
                {t.dashboard.wloResources}
              </h2>
            </div>

            <WLOResourceSearch
              selectedResources={wloResources}
              onSelect={setWloResources}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {t.common.cancel}
          </button>
          {!chatbotId ? (
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? t.common.loading : t.common.create}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              {t.common.finish}
            </button>
          )}
        </div>
      </form>

      {showImagePicker && (
        <WikimediaImagePicker
          onSelect={(url) => {
            setFormData({ ...formData, imageUrl: url });
            setShowImagePicker(false);
          }}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </div>
  );
}