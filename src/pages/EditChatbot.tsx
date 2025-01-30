import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, ArrowLeft, Image, FileText, X, Upload, Book } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import ToolManager from '../components/ToolManager';
import { useAuthStore } from '../store/authStore';
import { ChatbotTemplate, SUBJECTS, EDUCATION_LEVELS } from '../lib/types';
import WikimediaImagePicker from '../components/WikimediaImagePicker';
import DocumentUploadArea from '../components/DocumentUploadArea';
import WLOResourceSearch from '../components/WLOResourceSearch';

export default function EditChatbot() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [documents, setDocuments] = useState<Array<{ id: string; filename: string; created_at: string }>>([]);
  const [wloResources, setWloResources] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    imageUrl: '',
    enabledTools: [] as string[],
    subject: '',
    educationLevel: '',
    authorName: '',
    conversationStarters: ['', '', '', ''] as string[]
  });

  useEffect(() => {
    if (!user || !id) {
      navigate('/dashboard');
      return;
    }
    loadChatbot();
    loadDocuments();
    loadWloResources();
  }, [user, id]);

  async function loadChatbot() {
    try {
      const { data, error } = await supabase
        .from('chatbot_templates')
        .select('*')
        .eq('id', id)
        .eq('creator_id', user?.id)
        .single();

      if (error) throw error;
      if (!data) {
        navigate('/dashboard');
        return;
      }

      // Initialize conversation starters array with existing values or empty strings
      const starters = Array(4).fill('').map((_, i) => 
        data.conversation_starters?.[i] || ''
      );

      setFormData({
        name: data.name,
        description: data.description || '',
        systemPrompt: data.system_prompt || '',
        imageUrl: data.image_url || '',
        enabledTools: data.enabled_tools || [],
        subject: data.subject || '',
        educationLevel: data.education_level || '',
        authorName: data.author_name || user.full_name || '',
        conversationStarters: starters
      });
    } catch (err) {
      console.error('Error loading chatbot:', err);
      setError(t.common.error);
    }
  }

  async function loadWloResources() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('wlo_resources')
        .select('*')
        .eq('chatbot_id', id);

      if (error) throw error;

      // Transform database resources back to WLO format for the search component
      const transformedResources = data?.map(resource => ({
        id: resource.id,
        name: resource.title,
        properties: resource.properties || {
          'cclom:title': [resource.title],
          'cclom:general_description': [resource.description],
          'ccm:wwwurl': [resource.url],
          'ccm:taxonid_DISPLAYNAME': [resource.subject],
          'ccm:educationalcontext_DISPLAYNAME': resource.education_level,
          'ccm:oeh_lrt_aggregated_DISPLAYNAME': [resource.resource_type]
        },
        preview: resource.preview_url ? { url: resource.preview_url } : undefined
      })) || [];

      setWloResources(transformedResources);
    } catch (err) {
      console.error('Error loading WLO resources:', err);
    }
  }

  async function loadDocuments() {
    if (!id) return;
    
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
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from('chatbot_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      await loadDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(t.common.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    setLoading(true);
    setError('');

    try {
      // Update chatbot template
      const { error: updateError } = await supabase
        .from('chatbot_templates')
        .update({
          name: formData.name,
          description: formData.description,
          system_prompt: formData.systemPrompt,
          image_url: formData.imageUrl,
          enabled_tools: formData.enabledTools,
          subject: formData.subject || null,
          education_level: formData.educationLevel || null,
          author_name: formData.authorName || user.full_name,
          conversation_starters: formData.conversationStarters.filter(s => s.trim()),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('creator_id', user.id);

      if (updateError) throw updateError;

      // Update WLO resources - first delete existing ones
      await supabase
        .from('wlo_resources')
        .delete()
        .eq('chatbot_id', id);

      if (wloResources.length > 0) {
        const { error: wloError } = await supabase
          .from('wlo_resources')
          .insert(
            wloResources.map(resource => ({
              chatbot_id: id,
              title: resource.name || resource.properties?.['cclom:title']?.[0] || 'Untitled',
              description: resource.properties?.['cclom:general_description']?.[0] || '',
              url: resource.properties?.['ccm:wwwurl']?.[0] || '',
              preview_url: resource.preview?.url || null,
              subject: resource.properties?.['ccm:taxonid_DISPLAYNAME']?.[0] || null,
              education_level: resource.properties?.['ccm:educationalcontext_DISPLAYNAME'] || [],
              resource_type: resource.properties?.['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0] || null,
              properties: resource.properties // Store complete original properties
            }))
          );

        if (wloError) throw wloError;
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Error updating chatbot:', err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

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
            {t.dashboard.editChatbot}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.dashboard.author}
                </label>
                <input
                  type="text"
                  value={formData.authorName}
                  onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  placeholder={user?.full_name || ''}
                />
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

        {formData.enabledTools.includes('document_qa') && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-indigo-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  {t.dashboard.documents}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById('document-upload')?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
              >
                <Upload className="h-5 w-5" />
                {t.dashboard.uploadDocument}
              </button>
            </div>

            <div className="space-y-4">
              {documents.length > 0 ? (
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
              ) : (
                <div className="text-center py-6 text-gray-500">
                  {t.dashboard.noDocuments}
                </div>
              )}
            </div>

            <DocumentUploadArea
              chatbotId={id}
              onUploadComplete={loadDocuments}
            />
          </div>
        )}

        {formData.enabledTools.includes('wlo_resources') && (
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
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? t.common.loading : t.common.save}
          </button>
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