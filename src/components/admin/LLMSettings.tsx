import React, { useState } from 'react';
import { Save, Eye, EyeOff } from 'lucide-react';
import { LLMSettings } from '../../types/admin';

interface LLMSettingsProps {
  settings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
  providers: Record<string, {
    name: string;
    baseUrl: string;
    models: Array<{ id: string; name: string; }>;
  }>;
}

export default function LLMSettingsForm({ settings, onSave, providers }: LLMSettingsProps) {
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(currentSettings);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-medium text-gray-900 mb-6">
        LLM Provider Settings
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider
          </label>
          <select
            value={currentSettings.provider}
            onChange={(e) => {
              const provider = e.target.value;
              setCurrentSettings({
                ...currentSettings,
                provider,
                base_url: providers[provider].baseUrl,
                model: providers[provider].models[0].id
              });
            }}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {Object.entries(providers).map(([key, provider]) => (
              <option key={key} value={key}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Model
          </label>
          <select
            value={currentSettings.model}
            onChange={(e) => setCurrentSettings({
              ...currentSettings,
              model: e.target.value
            })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {providers[currentSettings.provider].models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL
          </label>
          <input
            type="url"
            value={currentSettings.base_url}
            onChange={(e) => setCurrentSettings({
              ...currentSettings,
              base_url: e.target.value
            })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={currentSettings.api_key}
              onChange={(e) => setCurrentSettings({
                ...currentSettings,
                api_key: e.target.value
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Superprompt
            <span className="ml-2 text-sm text-gray-500">
              This will be prepended to all chatbot system prompts
            </span>
          </label>
          <textarea
            value={currentSettings.superprompt || ''}
            onChange={(e) => setCurrentSettings({
              ...currentSettings,
              superprompt: e.target.value
            })}
            rows={10}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            placeholder="Enter the superprompt that will be added to all chatbots..."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
          >
            <Save className="h-5 w-5" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}