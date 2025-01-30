import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useLanguageStore } from '../lib/useTranslations';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
}

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder = 'Suchen...'
}: MultiSelectProps) {
  const { t } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  const removeOption = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(item => item !== option));
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm hover:cursor-pointer focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {selected.length === 0 ? (
          <span className="text-gray-500">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-sm text-indigo-700"
              >
                {item}
                <button
                  onClick={(e) => removeOption(item, e)}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filteredOptions.map(option => (
              <li
                key={option}
                onClick={() => toggleOption(option)}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <span className="text-sm">{option}</span>
                {selected.includes(option) && (
                  <Check className="h-4 w-4 text-indigo-600" />
                )}
              </li>
            ))}
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">
                {t.common.noResults}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}