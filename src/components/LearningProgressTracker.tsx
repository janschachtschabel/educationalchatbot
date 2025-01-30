import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { useLanguageStore } from '../lib/useTranslations';
import { learningProgress } from '../lib/learningProgress';
import { LearningProgress } from '../lib/types';

interface LearningProgressTrackerProps {
  chatbotId: string;
}

export default function LearningProgressTracker({ chatbotId }: LearningProgressTrackerProps) {
  const { t } = useLanguageStore();
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize progress on mount
  useEffect(() => {
    try {
      if (!learningProgress.isInitialized(chatbotId)) {
        learningProgress.initSession(chatbotId, chatbotId);
      }
    } catch (err) {
      console.error('Error initializing learning progress:', err);
      setError('Failed to initialize learning progress');
    }
  }, [chatbotId]);

  // Update progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (!learningProgress.isInitialized(chatbotId)) {
          return;
        }

        const currentProgress = learningProgress.getProgress(chatbotId);
        if (currentProgress) {
          setProgress(currentProgress);
          setError(null);
        }
      } catch (err) {
        console.error('Error updating learning progress:', err);
        setError('Failed to update learning progress');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [chatbotId]);

  if (!progress) return null;

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Lernfortschritt
      </h3>

      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-600 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {progress.objectives.map((objective) => (
          <div
            key={objective.id}
            className="bg-gray-50 rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {objective.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : objective.status === 'in_progress' ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">
                  {objective.title}
                </h4>
                
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, (objective.confidence / 5) * 100))}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 min-w-[3ch] text-right">
                    {objective.confidence.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}