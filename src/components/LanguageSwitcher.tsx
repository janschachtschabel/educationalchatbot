import React from 'react';
import { useLanguageStore } from '../lib/useTranslations';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('de')}
        className={`w-8 h-6 rounded overflow-hidden border-2 transition ${
          language === 'de' ? 'border-indigo-600 shadow-md' : 'border-gray-200'
        }`}
        title="Deutsch"
      >
        <img
          src="https://flagcdn.com/h20/de.png"
          srcSet="https://flagcdn.com/h40/de.png 2x"
          height="20"
          alt="Deutschland"
          className="w-full h-full object-cover"
        />
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`w-8 h-6 rounded overflow-hidden border-2 transition ${
          language === 'en' ? 'border-indigo-600 shadow-md' : 'border-gray-200'
        }`}
        title="English"
      >
        <img
          src="https://flagcdn.com/h20/gb.png"
          srcSet="https://flagcdn.com/h40/gb.png 2x"
          height="20"
          alt="Great Britain"
          className="w-full h-full object-cover"
        />
      </button>
    </div>
  );
}