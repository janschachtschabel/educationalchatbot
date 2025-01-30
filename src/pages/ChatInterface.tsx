import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, ArrowLeft, MessageSquare } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { ai, AIMessage } from '../lib/ai';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../lib/useTranslations';
import WLOResourceList from '../components/WLOResourceList';
import { tools } from '../lib/tools';
import LearningProgressTracker from '../components/LearningProgressTracker';
import { learningProgress } from '../lib/learningProgress';

interface EvaluationResponse {
  understanding: {
    score: number;
    reason: string;
  };
  application: {
    score: number;
    reason: string;
  };
  transfer: {
    score: number;
    reason: string;
  };
}

const LEARNING_EVAL_PROMPT = `
You are a learning progress evaluator. Analyze the conversation and evaluate the user's learning progress.
Focus on these three key areas:

1. Basic Understanding (Scale 0-5)
Consider:
- Comprehension of core concepts
- Ability to explain ideas in their own words
- Quality of questions asked
- Engagement with the material

2. Practical Application (Scale 0-5)
Consider:
- Attempts to apply concepts
- Problem-solving abilities
- Quality of exercises completed
- Improvement over time

3. Advanced Understanding & Transfer (Scale 0-5)
Consider:
- Connections made to other topics
- Critical thinking and analysis
- Understanding of relationships
- Ability to extend concepts

IMPORTANT: You must respond with a valid JSON object in exactly this format:
{
  "understanding": {
    "score": <number 0-5>,
    "reason": "<brief explanation>"
  },
  "application": {
    "score": <number 0-5>,
    "reason": "<brief explanation>"
  },
  "transfer": {
    "score": <number 0-5>,
    "reason": "<brief explanation>"
  }
}

Do not include any additional text or formatting. Only return the JSON object.`;

const validateEvaluation = (evaluation: any): evaluation is EvaluationResponse => {
  if (!evaluation || typeof evaluation !== 'object') return false;

  const validateScore = (score: any): boolean => {
    return typeof score === 'number' && score >= 0 && score <= 5;
  };

  const validateSection = (section: any): boolean => {
    return (
      section &&
      typeof section === 'object' &&
      validateScore(section.score) &&
      typeof section.reason === 'string'
    );
  };

  return (
    validateSection(evaluation.understanding) &&
    validateSection(evaluation.application) &&
    validateSection(evaluation.transfer)
  );
};

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  tokens?: number;
}

interface ChatbotTemplate {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  enabled_tools: string[];
  creator_id: string;
  conversation_starters?: string[];
}

export default function ChatInterface() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t, language } = useLanguageStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [chatbot, setChatbot] = useState<ChatbotTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [wloResources, setWloResources] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStarters, setShowStarters] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [sessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (id) {
      loadChatbot();
      // Initialize learning progress for this session
      learningProgress.initSession(id, sessionId);
    }
  }, [id]);

  useEffect(() => {
    if (chatbot?.enabled_tools?.includes('wlo_resources')) {
      loadWloResources();
    }
  }, [chatbot]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (chatbot) {
      updateSystemPrompt();
    }
  }, [chatbot, wloResources]);

  const updateSystemPrompt = () => {
    let prompt = chatbot.system_prompt;

    // Add WLO materials information if enabled and available
    if (chatbot.enabled_tools?.includes('wlo_resources') && wloResources.length > 0) {
      prompt = `${prompt}\n\nDu hast Zugriff auf folgende Lehr- und Lernmaterialien von WirLernenOnline, die du aktiv in den Lehr- und Lernprozess einbinden sollst:\n\n`;
      
      wloResources.forEach(resource => {
        const title = resource.properties?.['cclom:title']?.[0] || resource.name;
        const description = resource.properties?.['cclom:general_description']?.[0];
        const type = resource.properties?.['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0];
        const subject = resource.properties?.['ccm:taxonid_DISPLAYNAME']?.[0];
        
        prompt += `- ${title}\n`;
        if (description) prompt += `  Beschreibung: ${description}\n`;
        if (type) prompt += `  Typ: ${type}\n`;
        if (subject) prompt += `  Fach: ${subject}\n`;
        prompt += '\n';
      });

      prompt += '\nBitte empfehle diese Materialien in passenden Situationen und beziehe sie aktiv in deine Antworten ein.';
    }

    setSystemPrompt(prompt);
  };

  async function loadChatbot() {
    try {
      const { data, error } = await supabase
        .from('chatbot_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setChatbot(data);

      // Only add initial greeting
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `${t.chat.greeting} ${data.name}. ${data.description}`,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      console.error('Error loading chatbot:', error);
      setError('Failed to load chatbot');
    }
  }

  async function loadWloResources() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('wlo_resources')
        .select('*')
        .eq('chatbot_id', id);

      if (error) throw error;

      // Transform database resources back to WLO format for the search component
      const transformedResources = data?.map(resource => ({
        id: resource.id,
        name: resource.title,
        properties: resource.properties || {
          'cclom:title': [resource.title],
          'cclom:general_description': [resource.description],
          'ccm:wwwurl': [resource.url],
          'ccm:taxonid_DISPLAYNAME': [resource.subject],
          'ccm:educationalcontext_DISPLAYNAME': resource.education_level,
          'ccm:oeh_lrt_aggregated_DISPLAYNAME': [resource.resource_type]
        },
        preview: resource.preview_url ? { url: resource.preview_url } : undefined
      })) || [];

      setWloResources(transformedResources);
    } catch (err) {
      console.error('Error loading WLO resources:', err);
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStarterClick = async (starter: string) => {
    if (!chatbot || !id) return;
    await handleUserMessage(starter);
    setShowStarters(false);
  };

  const evaluateLearningProgress = async (messages: Message[], config: AIConfig) => {
    try {
      const evalMessages: AIMessage[] = [
        { role: 'system', content: LEARNING_EVAL_PROMPT },
        { 
          role: 'user', 
          content: JSON.stringify({
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          }, null, 2)
        }
      ];

      const { response: evalResponse } = await ai.chat(evalMessages, config);
      
      try {
        // Try to parse the response as JSON
        let evaluation: unknown;
        
        // Clean the response string - remove any markdown formatting or extra text
        const cleanedResponse = evalResponse
          .replace(/```json\s*|\s*```/g, '') // Remove markdown code blocks
          .trim();
        
        try {
          evaluation = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error('Failed to parse evaluation response:', parseError);
          console.log('Raw response:', evalResponse);
          console.log('Cleaned response:', cleanedResponse);
          return;
        }

        // Validate the evaluation structure
        if (!validateEvaluation(evaluation)) {
          console.error('Invalid evaluation structure:', evaluation);
          return;
        }

        // Update learning progress with validation
        const updates = [
          {
            id: '1',
            score: evaluation.understanding.score,
            status: evaluation.understanding.score >= 4 ? 'completed' : 'in_progress'
          },
          {
            id: '2',
            score: evaluation.application.score,
            status: evaluation.application.score >= 4 ? 'completed' : 'in_progress'
          },
          {
            id: '3',
            score: evaluation.transfer.score,
            status: evaluation.transfer.score >= 4 ? 'completed' : 'in_progress'
          }
        ];

        // Apply updates with error handling
        updates.forEach(update => {
          const success = learningProgress.updateObjective(sessionId, update.id, {
            confidence: update.score,
            status: update.status
          });

          if (!success) {
            console.warn(`Failed to update objective ${update.id}`);
          }
        });

      } catch (parseError) {
        console.error('Error parsing evaluation response:', parseError);
        console.log('Raw response:', evalResponse);
      }
    } catch (error) {
      console.error('Error evaluating learning progress:', error);
    }
  };

  const handleUserMessage = async (content: string) => {
    if (!chatbot || !id) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);
    setError(null);

    try {
      // Get AI config from creator's settings
      const config = await ai.getChatbotConfig(chatbot.creator_id);
      if (!config) {
        throw new Error('AI configuration not found');
      }

      // First, get the regular chat response
      const aiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        { role: 'user', content },
      ];

      // Get AI response with document context
      const { response, tokens } = await ai.chat(aiMessages, config, id);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        tokens,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Evaluate learning progress with all messages including the new ones
      await evaluateLearningProgress(
        messages.concat(userMessage, assistantMessage),
        config
      );

      // Save chat history
      if (user) {
        const { error: historyError } = await supabase
          .from('chat_sessions')
          .insert({
            chatbot_id: chatbot.id,
            session_id: id,
            user_id: user.id,
            messages: messages.concat(userMessage, assistantMessage),
            tokens_used: tokens,
          });

        if (historyError) {
          console.error('Error saving chat history:', historyError);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setError('Failed to process message');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !chatbot || !id) return;

    // Check if WLO search command is used
    if (message.startsWith('/wlo ')) {
      if (!chatbot.enabled_tools?.includes('wlo_search')) {
        const errorMessage = language === 'de'
          ? 'Der WLO-Suchbefehl ist für diesen Chatbot nicht aktiviert.'
          : 'The WLO search command is not enabled for this chatbot.';
          
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, assistantMessage]);
        setMessage('');
        return;
      }

      const query = message.slice(5).trim();
      try {
        const results = await tools.wloSearch(query, language);
        setWloResources(results);
        
        const response = language === 'de'
          ? `Ich habe nach "${query}" in WirLernenOnline gesucht und ${results.length} passende Materialien gefunden. Du findest sie in der rechten Seitenleiste.`
          : `I searched for "${query}" in WirLernenOnline and found ${results.length} matching materials. You can find them in the right sidebar.`;

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      } catch (err) {
        console.error('WLO search error:', err);
        const errorMessage = language === 'de'
          ? 'Entschuldigung, bei der WLO-Suche ist ein Fehler aufgetreten. Bitte versuche es später erneut.'
          : 'Sorry, there was an error performing the WLO search. Please try again later.';
          
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
      setMessage('');
      return;
    }

    await handleUserMessage(message);
  };

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex gap-4">
        {/* Left Sidebar - Learning Progress */}
        <div className="w-64 shrink-0">
          <div className="sticky top-4">
            <LearningProgressTracker chatbotId={sessionId} />
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(-1)}
                    className="text-gray-600 hover:text-gray-900 transition"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900">{chatbot?.name}</h2>
                </div>
              </div>
              <p className="text-gray-600">{chatbot?.description}</p>
            </div>

            <div className="h-[600px] flex flex-col">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.role === 'assistant' ? '' : 'justify-end'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-indigo-600" />
                      </div>
                    )}
                    <div
                      className={`rounded-lg p-3 max-w-[80%] ${
                        msg.role === 'assistant'
                          ? 'bg-indigo-50 text-gray-800 prose prose-sm max-w-none'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.tokens && (
                        <div className="mt-1 text-xs text-gray-500">
                          Tokens: {msg.tokens}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Conversation Starters - Fixed position at the bottom */}
              {showStarters && chatbot?.conversation_starters?.length > 0 && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {t.chat.suggestedTopics}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {chatbot.conversation_starters.map((starter, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          handleStarterClick(starter);
                          setShowStarters(false);
                        }}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        <MessageSquare className="h-4 w-4 flex-shrink-0" />
                        <span className="text-left">{starter}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
                <div className="flex gap-4">
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-100 rounded-full transition"
                    title={t.chat.uploadFile}
                  >
                    <Paperclip className="h-5 w-5 text-gray-500" />
                  </button>
                  <div className="flex-1 flex gap-4">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t.chat.typeMessage}
                      className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !message.trim()}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="h-5 w-5" />
                      {t.common.send}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right Sidebar - WLO Resources */}
        {chatbot?.enabled_tools?.includes('wlo_resources') && wloResources.length > 0 && (
          <div className="w-64 shrink-0">
            <div className="sticky top-4">
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {t.dashboard.wloResources}
                </h3>
                <WLOResourceList resources={wloResources} orientation="vertical" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}