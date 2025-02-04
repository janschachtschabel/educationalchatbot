import React, { useState, useRef } from 'react';
import { FileText, Upload, X, AlertCircle, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { extractTextFromPDF } from '../lib/pdfUtils';
import { ai } from '../lib/ai';

interface DocumentUploadAreaProps {
  chatbotId: string;
  onUploadComplete: () => void;
  showPlaceholder?: boolean;
}

interface ProcessingFile {
  name: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

export default function DocumentUploadArea({ chatbotId, onUploadComplete, showPlaceholder = false }: DocumentUploadAreaProps) {
  const { t } = useLanguageStore();
  const [dragOver, setDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<{
    [key: string]: ProcessingFile;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const updateFileProgress = (fileId: string, progress: number) => {
    setProcessingFiles(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        progress,
        status: 'processing'
      }
    }));
  };

  const handleFileUpload = async (files: FileList) => {
    if (!chatbotId) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `${Date.now()}-${i}`;

      // Add file to processing state
      setProcessingFiles(prev => ({
        ...prev,
        [fileId]: {
          name: file.name,
          status: 'uploading'
        }
      }));

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        setProcessingFiles(prev => ({
          ...prev,
          [fileId]: {
            name: file.name,
            status: 'error',
            error: t.dashboard.invalidFileType
          }
        }));
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setProcessingFiles(prev => ({
          ...prev,
          [fileId]: {
            name: file.name,
            status: 'error',
            error: t.dashboard.fileTooLarge
          }
        }));
        continue;
      }

      try {
        // Extract text content first
        let content = '';
        if (file.type === 'application/pdf') {
          setProcessingFiles(prev => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              status: 'processing',
              progress: 0
            }
          }));

          content = await extractTextFromPDF(file, (progress) => {
            updateFileProgress(fileId, progress * 0.5); // First 50% for text extraction
          });
        } else if (file.type === 'text/plain') {
          content = await file.text();
        } else {
          throw new Error('Unsupported file type');
        }

        if (!content) {
          throw new Error('Could not extract text from file');
        }

        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${chatbotId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        // Update progress to show embedding generation
        setProcessingFiles(prev => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            status: 'processing',
            progress: 50 // Start second half - embedding generation
          }
        }));

        // First create the document record
        const { data: docData, error: docError } = await supabase
          .from('chatbot_documents')
          .insert([{
            chatbot_id: chatbotId,
            filename: file.name,
            file_type: file.type,
            file_url: publicUrl,
            content: content,
            metadata: {
              original_size: file.size,
              processing_date: new Date().toISOString()
            }
          }])
          .select()
          .single();

        if (docError) throw docError;
        if (!docData) throw new Error('No document data returned');

        // Get AI config for embeddings
        const config = await ai.getChatbotConfig();

        // Split content into chunks and generate embeddings
        const chunks = content.match(/[^.!?]+[.!?]+/g) || [content];
        const totalChunks = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i].trim();
          if (!chunk) continue;

          // Generate embedding for chunk
          const embedding = await ai.getEmbeddings(chunk, config);

          // Insert chunk with embedding
          const { error: embeddingError } = await supabase
            .from('document_embeddings')
            .insert([{
              chatbot_id: chatbotId,
              document_id: docData.id, // Use the document ID from the created record
              content: chunk,
              embedding: embedding
            }]);

          if (embeddingError) throw embeddingError;

          // Update progress (50-100%)
          const progress = 50 + ((i + 1) / totalChunks * 50);
          setProcessingFiles(prev => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              progress
            }
          }));
        }

        // Update metadata with chunk count
        const { error: updateError } = await supabase
          .from('chatbot_documents')
          .update({
            metadata: {
              ...docData.metadata,
              chunk_count: chunks.length
            }
          })
          .eq('id', docData.id);

        if (updateError) throw updateError;

        // Update status to completed
        setProcessingFiles(prev => ({
          ...prev,
          [fileId]: {
            name: file.name,
            status: 'completed'
          }
        }));
      } catch (err) {
        console.error('Error processing file:', file.name, err);
        setProcessingFiles(prev => ({
          ...prev,
          [fileId]: {
            name: file.name,
            status: 'error',
            error: err instanceof Error ? err.message : t.common.error
          }
        }));
      }
    }

    onUploadComplete();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    await handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Clear completed files after 3 seconds
  React.useEffect(() => {
    const completedFiles = Object.entries(processingFiles).filter(([_, file]) => 
      file.status === 'completed' || file.status === 'error'
    );

    if (completedFiles.length > 0) {
      const timer = setTimeout(() => {
        setProcessingFiles(prev => {
          const newState = { ...prev };
          completedFiles.forEach(([id]) => {
            delete newState[id];
          });
          return newState;
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [processingFiles]);

  if (showPlaceholder) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t.dashboard.noDocuments}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-gray-400'
        } transition-colors cursor-pointer`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.txt,.docx"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              handleFileUpload(e.target.files);
            }
          }}
        />

        <div className="flex flex-col items-center">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            {t.dashboard.dropFilesHere}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {t.dashboard.allowedFileTypes}
          </p>
          <button
            type="button"
            className="bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {t.dashboard.selectFile}
          </button>
        </div>
      </div>

      {/* Processing Status */}
      {Object.entries(processingFiles).map(([id, file]) => (
        <div
          key={id}
          className={`flex items-center justify-between p-3 rounded-md ${
            file.status === 'error'
              ? 'bg-red-50 text-red-700'
              : file.status === 'completed'
              ? 'bg-green-50 text-green-700'
              : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <p className="font-medium">{file.name}</p>
              {file.error && (
                <p className="text-sm text-red-600">{file.error}</p>
              )}
              {file.progress !== undefined && (
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file.status === 'uploading' && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
            )}
            {file.status === 'processing' && (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                <span className="text-sm">
                  {file.progress !== undefined ? `${Math.round(file.progress)}%` : 'Processing...'}
                </span>
              </>
            )}
            {file.status === 'completed' && (
              <Check className="h-5 w-5 text-green-600" />
            )}
            {file.status === 'error' && (
              <X className="h-5 w-5 text-red-600" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}