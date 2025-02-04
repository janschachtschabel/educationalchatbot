import React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { ChatbotTemplate } from '../../types/admin';

interface GalleryManagementProps {
  chatbots: ChatbotTemplate[];
  onToggleVisibility: (chatbotId: string, isPublic: boolean) => void;
  onDelete?: (chatbotId: string) => void;
}

export default function GalleryManagement({ chatbots, onToggleVisibility, onDelete }: GalleryManagementProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          Gallery Management
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chatbots.map((chatbot) => (
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
                  onClick={() => onToggleVisibility(chatbot.id, chatbot.is_public)}
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
                {onDelete && (
                  <button
                    onClick={() => onDelete(chatbot.id)}
                    className="text-gray-400 hover:text-red-600 transition"
                    title="Delete chatbot"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}