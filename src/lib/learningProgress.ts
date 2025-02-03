import { LearningProgress, LearningObjective } from './types';

// Default objectives that will be used for new sessions
export const DEFAULT_OBJECTIVES: LearningObjective[] = [
  {
    id: '1',
    title: 'Grundlegendes Verständnis',
    status: 'not_started',
    confidence: 0
  },
  {
    id: '2',
    title: 'Anwendung des Wissens',
    status: 'not_started',
    confidence: 0
  },
  {
    id: '3',
    title: 'Vertiefung & Transfer',
    status: 'not_started',
    confidence: 0
  }
];

class LearningProgressManager {
  private sessionProgress: Map<string, LearningProgress> = new Map();
  private initialized: Map<string, boolean> = new Map();
  private storage: Storage | null = typeof window !== 'undefined' ? window.sessionStorage : null;

  // Initialize progress for a new chat session
  initSession(chatbotId: string, sessionId: string): LearningProgress {
    try {
      // Check if already initialized in memory
      if (this.initialized.get(sessionId)) {
        const memoryProgress = this.sessionProgress.get(sessionId);
        if (memoryProgress) {
          return memoryProgress;
        }
      }

      // Try to restore from session storage
      const storedProgress = this.storage?.getItem(`progress_${sessionId}`);
      if (storedProgress) {
        try {
          const parsed = JSON.parse(storedProgress);
          this.sessionProgress.set(sessionId, parsed);
          this.initialized.set(sessionId, true);
          return parsed;
        } catch (e) {
          console.warn('Failed to parse stored progress:', e);
          // Continue with new progress if parse fails
        }
      }

      // Create new progress if none exists
      const progress: LearningProgress = {
        chatbotId,
        sessionId,
        objectives: [...DEFAULT_OBJECTIVES],
        lastUpdated: new Date().toISOString()
      };

      this.sessionProgress.set(sessionId, progress);
      this.initialized.set(sessionId, true);
      this.saveToStorage(sessionId, progress);

      return progress;
    } catch (error) {
      console.error('Error initializing learning progress:', error);
      throw new Error('Failed to initialize learning progress');
    }
  }

  // Get progress for a session with initialization check
  getProgress(sessionId: string): LearningProgress | null {
    try {
      // First check memory
      if (this.initialized.get(sessionId)) {
        const memoryProgress = this.sessionProgress.get(sessionId);
        if (memoryProgress) {
          return memoryProgress;
        }
      }

      // Try to restore from storage if not in memory
      const storedProgress = this.storage?.getItem(`progress_${sessionId}`);
      if (storedProgress) {
        try {
          const parsed = JSON.parse(storedProgress);
          this.sessionProgress.set(sessionId, parsed);
          this.initialized.set(sessionId, true);
          return parsed;
        } catch (e) {
          console.warn('Failed to restore progress from storage:', e);
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting learning progress:', error);
      return null;
    }
  }

  // Update objective status and confidence with improved error handling
  updateObjective(
    sessionId: string,
    objectiveId: string,
    updates: Partial<{ status: LearningObjective['status']; confidence: number }>
  ): boolean {
    try {
      // Check initialization
      if (!this.initialized.get(sessionId)) {
        console.warn(`Cannot update objective: Session ${sessionId} not initialized`);
        return false;
      }

      const progress = this.sessionProgress.get(sessionId);
      if (!progress) {
        console.warn(`No progress found for session ${sessionId}`);
        return false;
      }

      const objective = progress.objectives.find(obj => obj.id === objectiveId);
      if (!objective) {
        console.warn(`No objective found with id ${objectiveId}`);
        return false;
      }

      // Validate updates
      if (updates.status && !['not_started', 'in_progress', 'completed'].includes(updates.status)) {
        console.warn(`Invalid status value: ${updates.status}`);
        return false;
      }

      if (typeof updates.confidence === 'number') {
        if (updates.confidence < 0 || updates.confidence > 5) {
          console.warn(`Invalid confidence value: ${updates.confidence}`);
          return false;
        }

        // Apply smoothing to confidence changes
        const currentConfidence = objective.confidence || 0;
        const targetConfidence = updates.confidence;
        const maxChange = 1.0; // Maximum allowed change per update
        
        const change = targetConfidence - currentConfidence;
        const smoothedChange = Math.min(Math.abs(change), maxChange) * Math.sign(change);
        objective.confidence = Math.max(0, Math.min(5, currentConfidence + smoothedChange));

        // Update status based on confidence
        if (objective.confidence >= 4) {
          objective.status = 'completed';
        } else if (objective.confidence > 0) {
          objective.status = 'in_progress';
        }
      }

      // Update status if explicitly provided
      if (updates.status) {
        objective.status = updates.status;
      }

      progress.lastUpdated = new Date().toISOString();
      this.sessionProgress.set(sessionId, progress);
      this.saveToStorage(sessionId, progress);

      return true;
    } catch (error) {
      console.error('Error updating learning objective:', error);
      return false;
    }
  }

  // Save progress to session storage
  private saveToStorage(sessionId: string, progress: LearningProgress): void {
    try {
      if (this.storage) {
        this.storage.setItem(`progress_${sessionId}`, JSON.stringify(progress));
      }
    } catch (error) {
      console.warn('Failed to save progress to storage:', error);
    }
  }

  // Clear session data
  clearSession(sessionId: string): void {
    try {
      this.sessionProgress.delete(sessionId);
      this.initialized.delete(sessionId);
      if (this.storage) {
        this.storage.removeItem(`progress_${sessionId}`);
      }
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  // Check if a session is initialized
  isInitialized(sessionId: string): boolean {
    return this.initialized.get(sessionId) || false;
  }
}

// Create and export a singleton instance
export const learningProgress = new LearningProgressManager();