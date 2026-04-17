import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageCircle, Clock, User, Bot, Download, Trash2, Edit3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsonAuthHeaders } from '@/lib/auth-headers';
import logger from '@/lib/logger';

interface Conversation {
  id: number;
  session_id: string;
  title: string;
  companion_name: string;
  message_count: number;
  last_message: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface Message {
  id: number;
  sender: 'user' | 'ai';
  content: string;
  emotion: string;
  timestamp: string;
}

const ConversationHistory: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.CONVERSATIONS, { headers: jsonAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      if (!data.conversations) throw new Error('Malformed response from server');
      setConversations(data.conversations);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to fetch conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const searchConversations = async () => {
    if (!searchTerm.trim()) {
      fetchConversations();
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS_SEARCH}?q=${encodeURIComponent(searchTerm)}`, { headers: jsonAuthHeaders() });
      if (!response.ok) throw new Error('Failed to search conversations');
      const data = await response.json();
      if (!data.conversations) throw new Error('Malformed response from server');
      setConversations(data.conversations);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to search conversations');
      setConversations([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.CONVERSATION_DETAIL(sessionId), { headers: jsonAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      if (!data.messages) throw new Error('Malformed response from server');
      setMessages(data.messages);
      setShowMessages(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const exportConversation = async (conversationId: number) => {
    setIsExporting(true);
    try {
      const response = await fetch(API_ENDPOINTS.CONVERSATION_EXPORT(conversationId.toString()), { headers: jsonAuthHeaders() });
      const data = await response.json();
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation_${conversationId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export conversation:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const updateTitle = async (conversationId: number, newTitle: string) => {
    setIsUpdatingTitle(true);
    try {
              await fetch(API_ENDPOINTS.CONVERSATION_TITLE(conversationId.toString()), {
        method: 'PUT',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ title: newTitle })
      });
      
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, title: newTitle } : conv
      ));
      setIsEditing(false);
    } catch (error) {
      logger.error('Failed to update title:', error);
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  const deleteConversation = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
              await fetch(API_ENDPOINTS.CONVERSATION_DELETE(sessionId), {
        method: 'DELETE',
        headers: jsonAuthHeaders(),
      });
      
      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.session_id !== sessionId));
      if (selectedConversation?.session_id === sessionId) {
        setSelectedConversation(null);
        setShowMessages(false);
      }
    } catch (error) {
      logger.error('Failed to delete conversation:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEmotionColor = (emotion: string) => {
    const colors: { [key: string]: string } = {
      'welcoming': 'bg-green-100 text-green-800',
      'empathetic': 'bg-blue-100 text-blue-800',
      'responsive': 'bg-purple-100 text-purple-800',
      'apologetic': 'bg-yellow-100 text-yellow-800',
      'neutral': 'bg-gray-100 text-gray-800'
    };
    return colors[emotion] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-pink-700 dark:text-pink-300">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={fetchConversations} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => navigate('/')} variant="outline">
                Go Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-pink-800 dark:text-pink-200">Conversation History</h1>
          <Button onClick={() => navigate('/')} variant="outline" className="border-pink-300 hover:bg-pink-50">
            Back to Home
          </Button>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversations ({conversations.length})
              </CardTitle>
              <div className="flex gap-2">
                <Input
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchConversations()}
                />
                <Button 
                  onClick={searchConversations} 
                  size="sm"
                  loading={isSearching}
                  loadingText="Searching..."
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <MessageCircle className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      {searchTerm ? 'No conversations found' : 'No conversations yet'}
                    </h3>
                    <p className="text-sm text-gray-500 text-center mb-4">
                      {searchTerm 
                        ? 'Try a different search term or clear your search'
                        : 'Start chatting with an AI companion to see your conversation history here'}
                    </p>
                    {!searchTerm && (
                      <Button 
                        onClick={() => navigate('/ai-companion-onboarding')}
                        className="mt-2"
                      >
                        Create AI Companion
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedConversation?.id === conversation.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedConversation(conversation);
                          fetchMessages(conversation.session_id);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{conversation.title}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {conversation.companion_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {conversation.message_count} messages
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(conversation.updated_at)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={isExporting}
                              loadingText="Exporting..."
                              onClick={(e) => {
                                e.stopPropagation();
                                exportConversation(conversation.id);
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={isDeleting}
                              loadingText="Deleting..."
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conversation.session_id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Messages View */}
        <div className="lg:col-span-2">
          {selectedConversation && showMessages ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && updateTitle(selectedConversation.id, editingTitle)}
                        />
                        <Button
                          size="sm"
                          loading={isUpdatingTitle}
                          loadingText="Saving..."
                          onClick={() => updateTitle(selectedConversation.id, editingTitle)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle>{selectedConversation.title}</CardTitle>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingTitle(selectedConversation.title);
                            setIsEditing(true);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {selectedConversation.companion_name}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportConversation(selectedConversation.id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Created: {formatDate(selectedConversation.created_at)} | 
                  Last updated: {formatDate(selectedConversation.updated_at)}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.sender === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {message.sender === 'user' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">
                              {message.sender === 'user' ? 'You' : selectedConversation.companion_name}
                            </span>
                            {message.emotion && (
                              <Badge className={`text-xs ${getEmotionColor(message.emotion)}`}>
                                {message.emotion}
                              </Badge>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                            <Clock className="h-3 w-3" />
                            {formatDate(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to view messages</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ConversationHistory;