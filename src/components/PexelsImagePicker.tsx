import React, { useState } from 'react';
import { Search, Image, X } from 'lucide-react';
import { useLanguageStore } from '../lib/useTranslations';

interface PexelsImage {
  id: string;
  src: {
    tiny: string;
    large: string;
  };
  photographer: string;
}

interface PexelsImagePickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

// Free demo API key for Pexels - rate limited but works for testing
const PEXELS_API_KEY = '563492ad6f91700001000001f89660371b8749b79f4d6ee0d20c8bd1';

export default function PexelsImagePicker({ onSelect, onClose }: PexelsImagePickerProps) {
  const { t } = useLanguageStore();
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<PexelsImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchImages = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setImages([]);

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20`,
        {
          headers: {
            'Authorization': PEXELS_API_KEY,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !Array.isArray(data.photos)) {
        throw new Error('Invalid response format');
      }
      
      setImages(data.photos);
    } catch (err) {
      console.error('Error searching images:', err);
      setError(t.common.error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && query.trim()) {
      searchImages();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Image className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {t.dashboard.selectImage}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t.dashboard.searchImages}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchImages}
              disabled={loading || !query.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  {t.common.loading}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {t.common.search}
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
          {images.map((image) => (
            <button
              key={image.id}
              onClick={() => onSelect(image.src.large)}
              className="group relative aspect-square overflow-hidden rounded-lg hover:opacity-90 transition"
            >
              <img
                src={image.src.tiny}
                alt={`By ${image.photographer}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  {t.common.select}
                </span>
              </div>
            </button>
          ))}
        </div>

        {images.length === 0 && !loading && !error && query.trim() && (
          <div className="text-center py-8 text-gray-500">
            {t.gallery.noChatbotsFound}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center">
          {t.dashboard.pexelsCredit}
        </div>
      </div>
    </div>
  );
}