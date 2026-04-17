import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Clock, MessageCircle, Download, Trash2, Hash, Smile } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsonAuthHeaders } from '@/lib/auth-headers';
import logger from '@/lib/logger';

interface MultiplayerSession {
  id: number;
  session_id: string;
  title: string;
  participant_count: number;
  message_count: number;
  last_message: string;
  created_at: string;
  updated_at: string;
  last_activity: string;
  is_active: boolean;
}

interface MultiplayerMessage {
  id: number;
  sender: string;
  content: string;
  message_type: 'chat' | 'question' | 'answer' | 'system' | 'emoji';
  question_number: number | null;
  timestamp: string;
}

const MultiplayerHistory: React.FC = () => {
  const [sessions, setSessions] = useState<MultiplayerSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<MultiplayerSession | null>(null);
  const [messages, setMessages] = useState<MultiplayerMessage[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.MULTIPLAYER_SESSIONS, { headers: jsonAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch multiplayer sessions');
      const data = await response.json();
      if (!data.sessions) throw new Error('Malformed response from server');
      setSessions(data.sessions);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to fetch multiplayer sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const searchSessions = async () => {
    if (!searchTerm.trim()) {
      fetchSessions();
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.MULTIPLAYER_SESSIONS_SEARCH}?q=${encodeURIComponent(searchTerm)}`, { headers: jsonAuthHeaders() });
      if (!response.ok) throw new Error('Failed to search multiplayer sessions');
      const data = await response.json();
      if (!data.sessions) throw new Error('Malformed response from server');
      setSessions(data.sessions);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to search multiplayer sessions');
      setSessions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.MULTIPLAYER_SESSION_DETAIL(sessionId), { headers: jsonAuthHeaders() });
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

  const exportSession = async (sessionId: string) => {
    setIsExporting(true);
    try {
      const response = await fetch(API_ENDPOINTS.MULTIPLAYER_SESSION_EXPORT(sessionId), { headers: jsonAuthHeaders() });
      const data = await response.json();
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `multiplayer_session_${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export session:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this multiplayer session? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
              await fetch(API_ENDPOINTS.MULTIPLAYER_SESSION_DELETE(sessionId), {
        method: 'DELETE',
        headers: jsonAuthHeaders(),
      });
      
      // Remove from local state
      setSessions(prev => prev.filter(session => session.session_id !== sessionId));
      if (selectedSession?.session_id === sessionId) {
        setSelectedSession(null);
        setShowMessages(false);
      }
    } catch (error) {
      logger.error('Failed to delete session:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageTypeIcon = (messageType: string) => {
    switch (messageType) {
      case 'question':
        return <Hash className="h-4 w-4" />;
      case 'emoji':
        return <Smile className="h-4 w-4" />;
      case 'answer':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getMessageTypeColor = (messageType: string) => {
    switch (messageType) {
      case 'question':
        return 'bg-blue-100 text-blue-800';
      case 'emoji':
        return 'bg-yellow-100 text-yellow-800';
      case 'answer':
        return 'bg-green-100 text-green-800';
      case 'system':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading multiplayer sessions...</div>
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
              <Button onClick={fetchSessions} variant="outline">
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
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Multiplayer Session History</h1>
        <Button onClick={() => navigate('/')} variant="outline">
          Back to Home
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Multiplayer Sessions ({sessions.length})
              </CardTitle>
              <div className="flex gap-2">
                <Input
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchSessions()}
                />
                <Button 
                  onClick={searchSessions} 
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
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Users className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      {searchTerm ? 'No sessions found' : 'No multiplayer sessions yet'}
                    </h3>
                    <p className="text-sm text-gray-500 text-center mb-4">
                      {searchTerm 
                        ? 'Try a different search term or clear your search'
                        : 'Join or create a multiplayer session to see your history here'}
                    </p>
                    {!searchTerm && (
                      <Button 
                        onClick={() => navigate('/multiplayer')}
                        className="mt-2"
                      >
                        Start Multiplayer Session
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSession?.id === session.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedSession(session);
                          fetchMessages(session.session_id);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{session.title}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              Session: {session.session_id}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {session.message_count} messages
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {session.participant_count} participants
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(session.updated_at)}
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
                                exportSession(session.session_id);
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
                                deleteSession(session.session_id);
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
          {selectedSession && showMessages ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedSession.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Session ID: {selectedSession.session_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {selectedSession.participant_count} participants
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportSession(selectedSession.session_id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Created: {formatDate(selectedSession.created_at)} | 
                  Last activity: {formatDate(selectedSession.last_activity)}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.sender === "You" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.sender === "You"
                              ? "bg-primary text-primary-foreground"
                              : message.sender === "System"
                              ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-center"
                              : "bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getMessageTypeIcon(message.message_type)}
                            <span className="text-sm font-medium">
                              {message.sender}
                            </span>
                            <Badge className={`text-xs ${getMessageTypeColor(message.message_type)}`}>
                              {message.message_type}
                            </Badge>
                            {message.question_number && (
                              <Badge variant="outline" className="text-xs">
                                Q#{message.question_number}
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
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a multiplayer session to view messages</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiplayerHistory;