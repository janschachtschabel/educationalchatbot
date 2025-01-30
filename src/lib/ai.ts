import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // Handle rate limiting
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await sleep(delay);
      return fetchWithRetry(url, options, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    return response;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await sleep(delay);
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
}

export const ai = {
  async getChatbotConfig(userId: string): Promise<AIConfig | null> {
    try {
      const { data: adminSettings, error: adminError } = await supabase
        .from('admin_settings')
        .select('provider, model, api_key, base_url, superprompt')
        .limit(1)
        .maybeSingle();

      if (adminError && adminError.code !== 'PGRST116') {
        console.error('Error fetching admin settings:', adminError);
        return null;
      }

      if (adminSettings) {
        return {
          provider: adminSettings.provider,
          model: adminSettings.model,
          apiKey: adminSettings.api_key,
          baseUrl: adminSettings.base_url,
          superprompt: adminSettings.superprompt
        };
      }

      return null;
    } catch (error) {
      console.error('Error in getChatbotConfig:', error);
      return null;
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
      return result.data[0].embedding;
    } catch (error) {
      console.error('Error getting embeddings:', error);
      throw error;
    }
  },

  async searchSimilarDocuments(chatbotId: string, query: string, config: AIConfig): Promise<string[]> {
    try {
      const queryEmbedding = await this.getEmbeddings(query, config);

      const { data: documents, error } = await supabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 3,
          p_chatbot_id: chatbotId
        });

      if (error) throw error;
      return documents.map(doc => doc.content);
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  },

  async chat(messages: AIMessage[], config: AIConfig, chatbotId?: string): Promise<{ response: string; tokens: number }> {
    try {
      if (!config || !config.apiKey) {
        throw new Error('Invalid AI configuration');
      }

      let contextMessages = [...messages];
      const lastMessage = messages[messages.length - 1];

      // Add document context if available
      if (chatbotId && lastMessage.role === 'user') {
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
      }

      // Add superprompt if available
      if (config.superprompt && contextMessages[0]?.role === 'system') {
        contextMessages[0].content = `${config.superprompt}\n\n${contextMessages[0].content}`;
      }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
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
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        response: result.choices[0].message.content,
        tokens: result.usage.total_tokens
      };
    } catch (error) {
      console.error('Error in AI chat:', error);
      throw error;
    }
  },

  async processDocument(chatbotId: string, documentId: string, config: AIConfig): Promise<void> {
    try {
      const { data: document, error: docError } = await supabase
        .from('chatbot_documents')
        .select('file_url, file_type')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      const response = await fetch(document.file_url);
      const buffer = await response.arrayBuffer();
      
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let text = decoder.decode(buffer)
        .replace(/\x00/g, '')
        .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .trim();

      // Delete existing embeddings
      await supabase
        .from('document_embeddings')
        .delete()
        .eq('document_id', documentId);

      const chunks = this.splitIntoChunks(text, 1000);
      const batchSize = 3; // Reduced batch size to prevent rate limiting

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        // Process chunks sequentially within each batch to handle rate limits better
        for (const chunk of batch) {
          if (!chunk.trim()) continue;

          try {
            const embedding = await this.getEmbeddings(chunk, config);
            
            const { error: insertError } = await supabase
              .from('document_embeddings')
              .insert({
                chatbot_id: chatbotId,
                document_id: documentId,
                content: chunk,
                embedding
              });

            if (insertError) throw insertError;

            // Small delay between chunks
            await sleep(200);
          } catch (err) {
            console.error('Error processing chunk:', err);
            // Continue with next chunk
          }
        }

        // Larger delay between batches
        if (i + batchSize < chunks.length) {
          await sleep(1000);
        }
      }
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  },

  splitIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (!cleanSentence) continue;

      if ((currentChunk + cleanSentence).length <= maxLength) {
        currentChunk += cleanSentence + '. ';
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = cleanSentence + '. ';
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }
};