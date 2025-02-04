import { supabase } from './supabase';
import { withConnectionCheck } from './supabase';

export interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  superprompt?: string;
}

export interface AIMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
  };
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_TIMEOUT = 30000; // Increased to 30 seconds for slower connections

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Default config as fallback
const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'sk-demo-key',
  baseUrl: 'https://api.openai.com/v1',
  superprompt: 'Du bist ein KI-Assistent für Lehr- und Lernsituationen und gibst sachlich korrekte, verständliche und fachlich fundierte Antworten.'
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MAX_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle rate limiting
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY * Math.pow(2, retryCount);
      await sleep(delay);
      return fetchWithRetry(url, options, retryCount + 1);
    }

    // Handle other recoverable errors
    if (!response.ok && retryCount < MAX_RETRIES) {
      if (response.status >= 500 || response.status === 429) {
        await sleep(RETRY_DELAY * Math.pow(2, retryCount));
        return fetchWithRetry(url, options, retryCount + 1);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es später erneut.');
      }

      // Retry on network errors
      if (error.name === 'TypeError' && retryCount < MAX_RETRIES) {
        await sleep(RETRY_DELAY * Math.pow(2, retryCount));
        return fetchWithRetry(url, options, retryCount + 1);
      }
    }

    throw error;
  }
}

export const ai = {
  async getChatbotConfig(): Promise<AIConfig> {
    try {
      // Try to get admin settings with retry
      const { data: adminSettings, error: adminError } = await withConnectionCheck(async () => 
        supabase
          .from('admin_settings')
          .select('provider, model, api_key, base_url, superprompt')
          .maybeSingle()
      );

      // Handle errors
      if (adminError) {
        console.error('Error fetching admin settings:', adminError);
        return DEFAULT_CONFIG;
      }

      // If no settings exist, return default config
      if (!adminSettings) {
        return DEFAULT_CONFIG;
      }

      // Return admin settings
      return {
        provider: adminSettings.provider || DEFAULT_CONFIG.provider,
        model: adminSettings.model || DEFAULT_CONFIG.model,
        apiKey: adminSettings.api_key || DEFAULT_CONFIG.apiKey,
        baseUrl: adminSettings.base_url || DEFAULT_CONFIG.baseUrl,
        superprompt: adminSettings.superprompt || DEFAULT_CONFIG.superprompt
      };
    } catch (error) {
      console.error('Error in getChatbotConfig:', error);
      return DEFAULT_CONFIG;
    }
  },

  async getEmbeddings(text: string, config: AIConfig): Promise<number[]> {
    try {
      const response = await fetchWithRetry(
        `${config.baseUrl}/embeddings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text,
          }),
        }
      );

      const result: EmbeddingResponse = await response.json();
      
      if (!result.data?.[0]?.embedding) {
        throw new Error('Invalid embedding response');
      }

      return result.data[0].embedding;
    } catch (error) {
      console.error('Error getting embeddings:', error);
      throw new Error('Fehler beim Verarbeiten des Dokuments. Bitte versuchen Sie es später erneut.');
    }
  },

  async searchSimilarDocuments(chatbotId: string, query: string, config: AIConfig): Promise<string[]> {
    try {
      const queryEmbedding = await this.getEmbeddings(query, config);

      const { data: documents, error } = await withConnectionCheck(async () =>
        supabase
          .rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: 3,
            p_chatbot_id: chatbotId
          })
      );

      if (error) throw error;
      return documents?.map(doc => doc.content) || [];
    } catch (error) {
      console.error('Error searching documents:', error);
      return []; // Return empty array instead of failing
    }
  },

  async chat(messages: AIMessage[], config: AIConfig, chatbotId?: string): Promise<{ response: string; tokens: number }> {
    if (!config || !config.apiKey) {
      throw new Error('Der Chatbot ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.');
    }

    try {
      let contextMessages = [...messages];
      const lastMessage = messages[messages.length - 1];

      // Add document context if available
      if (chatbotId && lastMessage.role === 'user') {
        try {
          const relevantDocs = await this.searchSimilarDocuments(
            chatbotId,
            lastMessage.content,
            config
          );

          if (relevantDocs.length > 0) {
            contextMessages.splice(messages.length - 1, 0, {
              role: 'system',
              content: `Here is relevant context from the knowledge base:\n\n${relevantDocs.join('\n\n')}`
            });
          }
        } catch (error) {
          console.error('Error fetching document context:', error);
          // Continue without document context rather than failing
        }
      }

      // Add superprompt if available
      if (config.superprompt && contextMessages[0]?.role === 'system') {
        contextMessages[0].content = `${config.superprompt}\n\n${contextMessages[0].content}`;
      }

      const response = await fetchWithRetry(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: contextMessages,
          temperature: 0.7,
          max_tokens: 1000,
          presence_penalty: 0.6,
          frequency_penalty: 0.6,
        }),
      });

      const result: ChatResponse = await response.json();
      
      if (!result.choices?.[0]?.message?.content) {
        throw new Error('Der Chatbot konnte keine gültige Antwort generieren. Bitte versuchen Sie es erneut.');
      }

      return {
        response: result.choices[0].message.content,
        tokens: result.usage.total_tokens
      };
    } catch (error) {
      console.error('Error in AI chat:', error);
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('API error (401)')) {
          throw new Error('Der Chatbot ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.');
        } else if (error.message.includes('API error (429)')) {
          throw new Error('Der Chatbot ist momentan ausgelastet. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.');
        } else if (error.message.includes('AbortError')) {
          throw new Error('Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.');
        }
        throw error;
      }
      
      throw new Error('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }
};