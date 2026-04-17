import React, { useState, useEffect } from "react";
import { API_ENDPOINTS } from "../config/api";
import { ArrowLeft, Bot, Send, Sparkles, Heart, Zap, Settings, XCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import HamburgerMenu from "@/components/HamburgerMenu";
import { apiClient } from "@/lib/api-client";
import { jsonAuthHeaders } from "@/lib/auth-headers";
import logger from "@/lib/logger";

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  emotion: string;
}

interface CompanionConfig {
  name: string;
  personality: string;
  identity: string;
  gender: string;
  role: string;
}

const AICompanionPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [companionConfig, setCompanionConfig] = useState<CompanionConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const navigate = useNavigate();

  // On mount: check for saved session/config and auto-resume if found
  useEffect(() => {
    const savedConfig = localStorage.getItem('aiCompanionConfig');
    const savedSessionId = localStorage.getItem('aiCompanionSessionId');
    const savedConversationId = localStorage.getItem('aiCompanionConversationId');

    if (!savedConfig) {
      navigate('/ai-companion-onboarding');
      return;
    }
    const config = JSON.parse(savedConfig);
    setCompanionConfig(config);

    // If session exists, fetch history and show banner
    if (savedSessionId && savedConversationId) {
      setSessionId(savedSessionId);
      setConversationId(Number(savedConversationId));
      fetchConversationHistory(savedSessionId, config);
      setShowResumeBanner(true);
    } else {
      // No session, start new
      initializeCompanion(config);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Save session/conversation IDs to localStorage for persistence
  useEffect(() => {
    if (sessionId) localStorage.setItem('aiCompanionSessionId', sessionId);
    if (conversationId) localStorage.setItem('aiCompanionConversationId', String(conversationId));
  }, [sessionId, conversationId]);

  // Fetch conversation history from backend
  const fetchConversationHistory = async (sessionId: string, config: CompanionConfig) => {
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get<{ messages: Array<{ id?: number; content: string; sender: string; timestamp: string; emotion?: string }> }>(`/api/conversations/${sessionId}`);
      if (response.data?.messages && Array.isArray(response.data.messages)) {
        const restoredMessages: Message[] = response.data.messages.map((msg: { id?: number; content: string; sender: string; timestamp: string; emotion?: string }, idx: number) => ({
          id: msg.id || idx + 1,
          text: msg.content,
          sender: msg.sender as "user" | "ai",
          timestamp: new Date(msg.timestamp),
          emotion: msg.emotion || 'neutral',
        }));
        setMessages(restoredMessages);
      } else {
        // Fallback: start new
        initializeCompanion(config);
      }
    } catch (error) {
      logger.error('Failed to fetch conversation history:', error);
      // Fallback: start new
      initializeCompanion(config);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const initializeCompanion = async (config: CompanionConfig) => {
    setIsInitializing(true);
    try {
      // Validate config before sending
      if (!config || !config.name || !config.personality || !config.identity || !config.gender || !config.role) {
        logger.error('Invalid companion config:', config);
        throw new Error('Companion configuration is incomplete');
      }

      const response = await fetch(API_ENDPOINTS.AI_INITIALIZE, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ companionConfig: config }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Failed to initialize companion:', response.status, errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      if (data.greeting) {
        const aiMessage: Message = {
          id: 1,
          text: data.greeting,
          sender: "ai",
          timestamp: new Date(),
          emotion: "welcoming"
        };
        setMessages([aiMessage]);
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Failed to initialize companion:', error);
      // Fallback greeting
      const fallbackMessage: Message = {
        id: 1,
        text: `Hello! I'm ${config?.name || 'your companion'}, your AI companion. I'm here to support and connect with you. What's on your mind today?`,
        sender: "ai",
        timestamp: new Date(),
        emotion: "welcoming"
      };
      setMessages([fallbackMessage]);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !companionConfig) return;
    
    // Capture message before clearing input
    const messageToSend = inputMessage.trim();
    
    setIsSending(true);
    const userMessage: Message = {
      id: messages.length + 1,
      text: messageToSend,
      sender: "user",
      timestamp: new Date(),
      emotion: "neutral"
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);
    try {
      const response = await fetch(API_ENDPOINTS.AI_CHAT, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          message: messageToSend,
          companionConfig: companionConfig,
          sessionId: sessionId,
          conversationId: conversationId
        }),
      });
      const data = await response.json();
      if (data.message) {
        const aiMessage: Message = {
          id: messages.length + 2,
          text: data.message,
          sender: "ai",
          timestamp: new Date(),
          emotion: "responsive"
        };
        setMessages(prev => [...prev, aiMessage]);
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
      } else if (data.error) {
        const fallbackMessage: Message = {
          id: messages.length + 2,
          text: data.message || "I'm here to listen and support you. Could you tell me more about that?",
          sender: "ai",
          timestamp: new Date(),
          emotion: "empathetic"
        };
        setMessages(prev => [...prev, fallbackMessage]);
      } else {
        const fallbackMessage: Message = {
          id: messages.length + 2,
          text: "I'm here to listen and support you. Could you tell me more about that?",
          sender: "ai",
          timestamp: new Date(),
          emotion: "empathetic"
        };
        setMessages(prev => [...prev, fallbackMessage]);
      }
    } catch (error) {
      logger.error('AI chat error:', error);
      
      let fallbackText = "I'm here to listen and support you. Could you tell me more about that?";
      let errorType = "connection";
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorType = "network";
          fallbackText = "I'm having trouble connecting right now. Please check your internet connection and try again.";
        } else if (error.message.includes('timeout')) {
          errorType = "timeout";
          fallbackText = "I'm taking longer than usual to respond. Please try again in a moment.";
        } else if (error.message.includes('rate limit')) {
          errorType = "rate_limit";
          fallbackText = "I'm getting too many requests right now. Please wait a moment before trying again.";
        }
      }
      
      if (inputMessage.toLowerCase().includes('hello') || inputMessage.toLowerCase().includes('hi')) {
        fallbackText = errorType === "network" ? "Hello! I'm having connection issues, but I'm here for you. How are you feeling today?" : "Hello! I'm here and ready to chat with you. How are you feeling today?";
      } else if (inputMessage.toLowerCase().includes('how are you')) {
        fallbackText = errorType === "network" ? "I'm having some technical difficulties, but I'm doing well! How about you?" : "I'm doing well, thank you for asking! I'm here to support and connect with you. How about you?";
      } else if (inputMessage.toLowerCase().includes('thank')) {
        fallbackText = "You're very welcome! I'm here for you whenever you need to talk.";
      }
      
      const errorMessage: Message = {
        id: messages.length + 2,
        text: fallbackText,
        sender: "ai",
        timestamp: new Date(),
        emotion: errorType === "network" ? "apologetic" : "empathetic"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetCompanion = () => {
    localStorage.removeItem('aiCompanionConfig');
    localStorage.removeItem('aiCompanionSessionId');
    localStorage.removeItem('aiCompanionConversationId');
    navigate('/ai-companion-onboarding');
  };

  const getEmotionColor = (emotion: string) => {
    const colors = {
      welcoming: "from-green-400 to-emerald-500",
      curious: "from-blue-400 to-cyan-500",
      empathetic: "from-purple-400 to-pink-500",
      admiring: "from-rose-400 to-pink-500",
      grateful: "from-amber-400 to-orange-500",
      thoughtful: "from-indigo-400 to-purple-500",
      appreciative: "from-teal-400 to-green-500",
      responsive: "from-pink-400 to-rose-500",
      apologetic: "from-gray-400 to-gray-500",
      neutral: "from-gray-400 to-gray-500"
    };
    return colors[emotion as keyof typeof colors] || colors.neutral;
  };

  if (!companionConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-pink-700 dark:text-pink-300">
            {isInitializing ? "Initializing your companion..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800 flex flex-col">
      {/* Subtle resume banner */}
      {showResumeBanner && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-white/90 dark:bg-black/80 border border-pink-200 dark:border-pink-800 rounded-lg shadow-lg px-4 py-2">
            <Sparkles className="h-4 w-4 text-pink-400" />
            <span className="text-sm text-pink-700 dark:text-pink-200">
              Resumed your last chat with <b>{companionConfig.name}</b>.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-pink-300 text-pink-700 hover:bg-pink-50 ml-2"
              onClick={handleResetCompanion}
            >
              Start New Companion
            </Button>
            <button
              className="ml-1 text-pink-400 hover:text-pink-600"
              onClick={() => setShowResumeBanner(false)}
              aria-label="Dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

        {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 sm:p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-pink-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm sm:text-lg">{companionConfig.name}</h1>
            <div className="flex items-center gap-1 sm:gap-2 text-xs">
              <span className="text-pink-100">AI Companion</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-pink-100">Online</span>
            </div>
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/solo')}
            className="text-white hover:bg-pink-600/20"
          >
            <Heart className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Solo</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/multiplayer')}
            className="text-white hover:bg-pink-600/20"
          >
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Multiplayer</span>
          </Button>
          <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300">
            <Sparkles className="w-3 h-3 mr-1" />
            Learning Mode
          </Badge>
          <Badge variant="secondary" className="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
            <Heart className="w-3 h-3 mr-1" />
            Empathy Level: High
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetCompanion}
            className="text-white hover:bg-pink-600/20"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile Hamburger Menu */}
        <HamburgerMenu 
          currentPage="ai-companion"
          onResetCompanion={handleResetCompanion}
        />
      </div>

      {/* Main Content: Two-column layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 max-w-7xl mx-auto w-full p-4 sm:p-6">
        {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            <Card className="flex-1 border-pink-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-6 h-80 sm:h-96 overflow-y-auto space-y-3 sm:space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-6 sm:py-8 text-pink-400">
                  <Bot className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm sm:text-base">
                    {isLoadingHistory ? "Loading conversation history..." : "No messages yet. Start the conversation!"}
                  </p>
                </div>
              )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div className={`flex items-start gap-2 sm:gap-3 max-w-xs sm:max-w-lg ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${
                        msg.sender === 'user' 
                          ? 'from-pink-400 to-rose-500' 
                          : getEmotionColor(msg.emotion)
                      }`}>
                        {msg.sender === 'user' ? (
                          <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        ) : (
                          <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        )}
                      </div>
                      <div className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ${
                        msg.sender === 'user' 
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white' 
                          : 'bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/50 dark:to-rose-900/50 text-foreground'
                      }`}>
                        <p className="text-xs sm:text-sm leading-relaxed">{msg.text}</p>
                        <div className="flex items-center justify-between mt-1 sm:mt-2">
                          <p className={`text-xs ${
                            msg.sender === 'user' 
                              ? 'text-pink-100' 
                              : 'text-muted-foreground'
                          }`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        {msg.sender === 'ai' && msg.emotion && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-white/50 text-pink-700 dark:bg-black/30 dark:text-pink-300"
                            >
                              {msg.emotion}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-500">
                        <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/50 dark:to-rose-900/50 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Message Input */}
          <div className="bg-white dark:bg-black/40 p-3 sm:p-4 border-t border-pink-200/40 dark:border-pink-800/40 sticky bottom-0 z-10">
            <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isTyping ? "AI is typing..." : isSending ? "Sending..." : "Share anything on your heart..."}
                className="flex-1 border-pink-200 focus:border-pink-400 bg-white/80 dark:bg-black/40 backdrop-blur-sm text-sm"
                disabled={isTyping || isSending}
              />
              <Button
                type="submit"
                disabled={!inputMessage.trim() || isTyping || isSending}
                loading={isSending}
                loadingText="Sending..."
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-3 sm:px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
          {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-4 sm:space-y-6 mt-6 sm:mt-8 lg:mt-0">
            {/* Companion Info */}
            <Card className="border-pink-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-pink-800 dark:text-pink-200 flex items-center gap-2 text-sm sm:text-base">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                About {companionConfig.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {companionConfig.personality}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Empathy</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Heart key={i} className="w-3 h-3 text-pink-400 fill-current" />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Intelligence</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Zap key={i} className="w-3 h-3 text-purple-400 fill-current" />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Creativity</span>
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <Sparkles key={i} className="w-3 h-3 text-indigo-400 fill-current" />
                      ))}
                      <Sparkles className="w-3 h-3 text-gray-300" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Quick Topics */}
            <Card className="border-pink-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-pink-800 dark:text-pink-200 text-sm sm:text-base">Quick Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {["Dreams", "Love", "Art", "Music", "Philosophy", "Future"].map((topic) => (
                    <Button
                      key={topic}
                      variant="outline"
                      size="sm"
                      className="text-xs border-pink-200 hover:bg-pink-100 hover:border-pink-300"
                    onClick={() => setInputMessage(`Let's talk about ${topic.toLowerCase()}`)}
                    >
                      {topic}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      {/* Footer */}
        <div className="text-center p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground italic">
            "In the realm of AI and human connection, understanding knows no boundaries."
          </p>
      </div>
    </div>
  );
};

export default AICompanionPage;