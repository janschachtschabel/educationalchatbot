import React, { useState, useEffect } from 'react';
import { File, X, Loader2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';

interface DocumentUploadProps {
  chatbotId: string;
  onUploadComplete: () => void;
  onClose: () => void;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

export default function DocumentUpload({ chatbotId, onUploadComplete, onClose }: DocumentUploadProps) {
  const { t } = useLanguageStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    loadDocuments();
  }, [chatbotId]);

  async function loadDocuments() {
    try {
      const { data, error } = await supabase
        .from('chatbot_documents')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      setError(t.common.error);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, TXT, and DOCX files are allowed');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${chatbotId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: docError } = await supabase
        .from('chatbot_documents')
        .insert([
          {
            chatbot_id: chatbotId,
            filename: file.name,
            file_type: file.type,
            file_url: publicUrl,
          },
        ]);

      if (docError) throw docError;

      await loadDocuments();
      onUploadComplete();
    } catch (error) {
      console.error('Error uploading document:', error);
      setError(t.common.error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    try {
      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      const fileName = document.file_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('documents')
          .remove([`${chatbotId}/${fileName}`]);
      }

      const { error } = await supabase
        .from('chatbot_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      setDocuments(documents.filter(d => d.id !== documentId));
    } catch (error) {
      console.error('Error deleting document:', error);
      setError(t.common.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 relative">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t.dashboard.documents}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">{t.dashboard.documents}</h3>
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <div className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50">
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t.common.loading}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span>{t.dashboard.uploadDocument}</span>
                  </>
                )}
              </div>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="border rounded-lg divide-y">
            {documents.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                {t.dashboard.noDocuments}
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <File className="h-5 w-5 text-gray-400" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {doc.filename}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}