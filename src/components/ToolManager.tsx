import React from 'react';
import { FileText, Book, BarChart2, Shield } from 'lucide-react';
import { useLanguageStore } from '../lib/useTranslations';

interface ToolManagerProps {
  enabledTools: string[];
  onChange: (tools: string[]) => void;
}

interface Tool {
  id: string;
  icon: React.ReactNode;
}

export default function ToolManager({ enabledTools, onChange }: ToolManagerProps) {
  const { t } = useLanguageStore();

  const availableTools: Tool[] = [
    {
      id: 'document_qa',
      icon: <FileText className="h-5 w-5" />,
    },
    {
      id: 'wlo_resources',
      icon: <Book className="h-5 w-5" />,
    },
    {
      id: 'learning_progress',
      icon: <BarChart2 className="h-5 w-5" />,
    },
    {
      id: 'output_control',
      icon: <Shield className="h-5 w-5" />,
    }
  ];

  const handleToolToggle = (toolId: string) => {
    const newTools = enabledTools.includes(toolId)
      ? enabledTools.filter(id => id !== toolId)
      : [...enabledTools, toolId];
    onChange(newTools);
  };

  const getToolName = (toolId: string): string => {
    switch (toolId) {
      case 'document_qa': return t.tools.documentQA;
      case 'wlo_resources': return t.tools.wloResources;
      case 'learning_progress': return t.tools.learningProgress;
      case 'output_control': return t.tools.outputControl;
      default: return toolId;
    }
  };

  const getToolDescription = (toolId: string): string => {
    switch (toolId) {
      case 'document_qa': return t.tools.documentQADesc;
      case 'wlo_resources': return t.tools.wloResourcesDesc;
      case 'learning_progress': return t.tools.learningProgressDesc;
      case 'output_control': return t.tools.outputControlDesc;
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        {t.tools.enableTools}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableTools.map((tool) => (
          <label
            key={tool.id}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${
              enabledTools.includes(tool.id)
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={enabledTools.includes(tool.id)}
              onChange={() => handleToolToggle(tool.id)}
              className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-indigo-600">{tool.icon}</div>
                <span className="font-medium text-gray-900">{getToolName(tool.id)}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{getToolDescription(tool.id)}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}