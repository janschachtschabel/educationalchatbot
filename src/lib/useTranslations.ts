import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, TranslationType, Language } from './translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationType[Language];
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'de',
      setLanguage: (lang) => set((state) => ({ 
        language: lang,
        t: translations[lang]
      })),
      t: translations.de,
    }),
    {
      name: 'language-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = translations[state.language];
        }
      },
    }
  )
);