import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { ai, AIMessage } from '../lib/ai';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../lib/useTranslations';
import WLOResourceList from '../components/WLOResourceList';
import LearningProgressTracker from '../components/LearningProgressTracker';
import { learningProgress, DEFAULT_OBJECTIVES } from '../lib/learningProgress';

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
  is_public: boolean;
}

export default function ChatInterface() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
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

  // Store messages in sessionStorage for anonymous users
  useEffect(() => {
    if (!user && messages.length > 0) {
      sessionStorage.setItem(`chat-${id}`, JSON.stringify(messages));
    }
  }, [messages, id, user]);

  // Load messages from sessionStorage for anonymous users
  useEffect(() => {
    if (!user && id) {
      const savedMessages = sessionStorage.getItem(`chat-${id}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    }
  }, [id, user]);

  // Clean up sessionStorage when component unmounts
  useEffect(() => {
    return () => {
      if (!user && id) {
        sessionStorage.removeItem(`chat-${id}`);
      }
    };
  }, [id, user]);

  useEffect(() => {
    if (id) {
      loadChatbot();
      if (chatbot?.enabled_tools?.includes('learning_progress')) {
        learningProgress.initSession(id, sessionId);
      }
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function loadChatbot() {
    try {
      // First try to get the chatbot
      const { data: chatbot, error: chatbotError } = await supabase
        .from('chatbot_templates')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (chatbotError) {
        if (chatbotError.code === 'PGRST116') {
          throw new Error('Dieser Chatbot wurde nicht gefunden.');
        }
        throw chatbotError;
      }

      if (!chatbot) {
        throw new Error('Dieser Chatbot ist nicht verfügbar.');
      }

      // Check if user has access
      const hasAccess = await checkChatbotAccess(chatbot);
      if (!hasAccess) {
        navigate(`/gallery?chatbot=${id}`);
        return;
      }

      setChatbot(chatbot);

      // Add initial greeting
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `${t.chat.greeting} ${chatbot.name}. ${chatbot.description}`,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      console.error('Error loading chatbot:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Der Chatbot konnte nicht geladen werden.';
      setError(errorMessage);
    }
  }

  async function checkChatbotAccess(chatbot: ChatbotTemplate): Promise<boolean> {
    // Allow access if:
    // 1. Chatbot is public
    // 2. User is the creator
    if (chatbot.is_public || user?.id === chatbot.creator_id) {
      return true;
    }

    // For non-public chatbots, check password protection
    const { data: passwordData, error: passwordError } = await supabase
      .from('chatbot_passwords')
      .select('id')
      .eq('chatbot_id', chatbot.id)
      .eq('is_active', true)
      .maybeSingle();

    if (passwordError) {
      console.error('Error checking password:', passwordError);
      return false;
    }

    // If no password is set, allow access
    // If password is set, access will be handled by the Gallery component
    return !passwordData;
  }

  async function loadWloResources() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('wlo_resources')
        .select('*')
        .eq('chatbot_id', id);

      if (error) throw error;
      setWloResources(data || []);
    } catch (err) {
      console.error('Error loading WLO resources:', err);
      // Non-critical - continue without WLO resources
    }
  }

  const updateSystemPrompt = () => {
    if (!chatbot) return;
    
    let prompt = chatbot.system_prompt;

    // Add WLO materials information if enabled and available
    if (chatbot.enabled_tools?.includes('wlo_resources') && wloResources.length > 0) {
      prompt = `${prompt}\n\nDu hast Zugriff auf folgende Lehr- und Lernmaterialien von WirLernenOnline, die du aktiv in den Lehr- und Lernprozess einbinden sollst:\n\n`;
      
      wloResources.forEach(resource => {
        const title = resource.title || resource.name;
        prompt += `- ${title}\n`;
        if (resource.description) prompt += `  Beschreibung: ${resource.description}\n`;
        if (resource.resource_type) prompt += `  Typ: ${resource.resource_type}\n`;
        if (resource.subject) prompt += `  Fach: ${resource.subject}\n`;
        prompt += '\n';
      });

      prompt += '\nBitte empfehle diese Materialien in passenden Situationen und beziehe sie aktiv in deine Antworten ein.';
    }

    setSystemPrompt(prompt);
  };

  const evaluateLearningProgress = async (messages: Message[], config: any) => {
    if (!chatbot?.enabled_tools?.includes('learning_progress')) return;
    
    try {
      // Create a more structured prompt for better evaluation
      const evalMessages: AIMessage[] = [
        { 
          role: 'system', 
          content: `You are a learning progress evaluator. Analyze the conversation and evaluate the progress for each learning objective:

1. Grundlegendes Verständnis (ID: 1)
2. Anwendung des Wissens (ID: 2)
3. Vertiefung & Transfer (ID: 3)

For each objective, provide a confidence score between 0-5 where:
0 = No evidence
1-2 = Basic understanding
3-4 = Good progress
5 = Mastery

IMPORTANT: You must respond with a valid JSON object in exactly this format:
{
  "1": <score>,
  "2": <score>,
  "3": <score>
}

Do not include any additional text or explanation.` 
        },
        { 
          role: 'user', 
          content: JSON.stringify({
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          })
        }
      ];

      const { response } = await ai.chat(evalMessages, config);
      
      try {
        // Validate response format
        const evaluation = JSON.parse(response);
        
        // Ensure the evaluation has the correct structure
        if (typeof evaluation !== 'object' || evaluation === null) {
          throw new Error('Invalid evaluation format');
        }

        // Validate and process each objective
        Object.entries(evaluation).forEach(([objectiveId, score]) => {
          // Ensure score is a number between 0 and 5
          const numScore = Number(score);
          if (isNaN(numScore) || numScore < 0 || numScore > 5) {
            throw new Error(`Invalid score for objective ${objectiveId}`);
          }

          // Update learning progress with validated score
          learningProgress.updateObjective(sessionId, objectiveId, {
            confidence: numScore,
            status: numScore >= 4 ? 'completed' : numScore > 0 ? 'in_progress' : 'not_started'
          });
        });
      } catch (parseError) {
        console.error('Error parsing evaluation:', parseError);
        // Set default progress values instead of failing
        DEFAULT_OBJECTIVES.forEach(obj => {
          learningProgress.updateObjective(sessionId, obj.id, {
            confidence: 0,
            status: 'not_started'
          });
        });
      }
    } catch (error) {
      console.error('Error evaluating learning progress:', error);
      // Don't throw - this is a non-critical feature
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
      const config = await ai.getChatbotConfig();

      const aiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt || chatbot.system_prompt },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        { role: 'user', content },
      ];

      const { response, tokens } = await ai.chat(aiMessages, config, id);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        tokens,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Track token usage without user data
      try {
        await supabase
          .from('usage_logs')
          .insert({
            chatbot_id: id,
            tokens_used: tokens,
            user_id: user?.id // Optional - only set if user is logged in
          });
      } catch (usageError) {
        console.error('Error logging usage:', usageError);
      }

      // Evaluate learning progress if enabled
      if (chatbot.enabled_tools?.includes('learning_progress')) {
        await evaluateLearningProgress(
          messages.concat(userMessage, assistantMessage),
          config
        );
      }

      // Save chat history for logged-in users only
      if (user) {
        await saveChatHistory(userMessage, assistantMessage, tokens);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorContent = error instanceof Error 
        ? error.message
        : 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ${errorContent}`,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const saveChatHistory = async (userMessage: Message, assistantMessage: Message, tokens: number) => {
    if (!user || !id) return; // Only save history for logged-in users
    
    try {
      const { error: historyError } = await supabase
        .from('chat_sessions')
        .insert({
          chatbot_id: id,
          session_id: sessionId,
          user_id: user.id,
          messages: messages.concat(userMessage, assistantMessage),
          tokens_used: tokens,
        });

      if (historyError) throw historyError;
    } catch (error) {
      console.error('Error saving chat history:', error);
      // Don't throw - this is a non-critical operation
    }
  };

  const handleStarterClick = async (starter: string) => {
    if (!chatbot || !id) return;
    await handleUserMessage(starter);
    setShowStarters(false);
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-red-700 mb-2">
            {error}
          </h2>
          <button
            onClick={() => navigate('/gallery')}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
          >
            {t.common.backToGallery}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex gap-4">
        {/* Left Sidebar - Learning Progress (now for all users) */}
        {chatbot?.enabled_tools?.includes('learning_progress') && (
          <div className="w-64 shrink-0">
            <div className="sticky top-4">
              <LearningProgressTracker chatbotId={sessionId} />
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className={`flex-1 ${
          !chatbot?.enabled_tools?.includes('learning_progress') && 
          !chatbot?.enabled_tools?.includes('wlo_resources') 
            ? 'max-w-4xl mx-auto' 
            : ''
        }`}>
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

              {/* Conversation Starters */}
              {showStarters && chatbot?.conversation_starters?.length > 0 && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {t.chat.suggestedTopics}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {chatbot.conversation_starters.map((starter, index) => (
                      <button
                        key={index}
                        onClick={() => handleStarterClick(starter)}
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
              <form onSubmit={(e) => {
                e.preventDefault();
                if (message.trim()) handleUserMessage(message);
              }} className="border-t border-gray-200 p-4">
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