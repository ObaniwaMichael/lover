import React, { useState } from "react";
import { ArrowLeft, Heart, Send, User, Crown, MessageCircle, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TruthOrDareSpinner from "@/components/TruthOrDareSpinner";
import SelfChatSystem from "@/components/SelfChatSystem";
import { Badge } from "@/components/ui/badge";
import HamburgerMenu from "@/components/HamburgerMenu";

const SoloPage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Welcome to your solo journey! This is your personal space to practice conversations, explore your thoughts, and discover what makes your heart sing. What's on your mind today?",
      sender: "system",
      timestamp: new Date()
    }
  ]);
  const [activeTab, setActiveTab] = useState("chat");

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      text: message,
      sender: "user",
      timestamp: new Date()
    };

    setMessages([...messages, newMessage]);
    setMessage("");

    // Simulate a thoughtful response
    setTimeout(() => {
      const responses = [
        "That's a beautiful thought. Tell me more about what inspired you to share that.",
        "I can sense the emotions behind your words. How does that make you feel?",
        "Your perspective is unique and valuable. What would you like to explore next?",
        "There's poetry in your message. What does your heart want to say?",
      ];
      
      const response = {
        id: messages.length + 2,
        text: responses[Math.floor(Math.random() * responses.length)],
        sender: "system",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, response]);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[var(--app-height)] max-h-[var(--app-height)] w-full min-h-0 max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-gradient-to-br from-slate-100 via-purple-50 to-slate-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800">
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 sm:p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-purple-700/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm sm:text-lg">Solo Journey</h1>
            <div className="flex items-center gap-1 sm:gap-2 text-xs">
              <span className="text-purple-100">Self-Discovery</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-purple-100">Active</span>
            </div>
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/multiplayer')}
            className="text-white hover:bg-purple-700/20"
          >
            <Users className="w-4 h-4 mr-1" />
            Multiplayer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ai-companion-onboarding')}
            className="text-white hover:bg-purple-700/20"
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            AI Companion
          </Button>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
            <Sparkles className="w-3 h-3 mr-1" />
            Growth Mode
          </Badge>
        </div>

        {/* Mobile Hamburger Menu */}
        <HamburgerMenu currentPage="solo" />
      </div>

      {/* Main Content: Two-column layout */}
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 p-3 sm:gap-6 sm:p-6 lg:flex-row">
        {/* Main: fills space; bottom tab bar is inside Tabs. order-2 = below sidebar on small screens */}
        <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-1">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full min-h-0 w-full flex-col-reverse gap-0 lg:flex-col"
          >
            <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 sm:gap-1 shrink-0 rounded-md bg-white/90 p-1 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] ring-1 ring-border/50 backdrop-blur-md dark:bg-gray-900/90 max-lg:rounded-t-xl max-lg:rounded-b-none max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))] max-lg:pt-2 sm:mb-0 lg:mb-6 lg:rounded-md lg:shadow-none lg:ring-0">
              <TabsTrigger
                value="chat"
                className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] leading-tight sm:min-h-10 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Solo Chat</span>
                <span className="max-sm:truncate sm:hidden">Chat</span>
              </TabsTrigger>
              <TabsTrigger
                value="spinner"
                className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] leading-tight sm:min-h-10 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Truth or Dare</span>
                <span className="max-sm:truncate sm:hidden">Dare</span>
              </TabsTrigger>
              <TabsTrigger
                value="selfchat"
                className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] leading-tight sm:min-h-10 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
              >
                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Self Chat</span>
                <span className="max-sm:truncate sm:hidden">Self</span>
              </TabsTrigger>
            </TabsList>

            {/* Solo Chat Tab */}
            <TabsContent
              value="chat"
              className="mt-0 min-h-0 flex-1 flex flex-col data-[state=inactive]:hidden"
            >
              <div className="flex min-h-0 flex-1 flex-col space-y-3 sm:space-y-4">
              <Card className="flex min-h-0 min-w-0 flex-1 flex-col border-rose-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
                <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:space-y-4 sm:p-6 [-webkit-overflow-scrolling:touch]">
                  {messages.length === 0 && (
                    <div className="text-center py-6 sm:py-8 text-rose-400">
                      <Heart className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm sm:text-base">No messages yet. Start the conversation!</p>
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
                            ? 'from-rose-400 to-pink-500' 
                            : 'from-purple-400 to-indigo-500'
                        }`}>
                          {msg.sender === 'user' ? (
                            <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                          ) : (
                            <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                          )}
                        </div>
                        <div className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ${
                          msg.sender === 'user' 
                            ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white' 
                            : 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/50 dark:to-indigo-900/50 text-foreground'
                        }`}>
                          <p className="text-xs sm:text-sm leading-relaxed">{msg.text}</p>
                          <div className="flex items-center justify-between mt-1 sm:mt-2">
                            <p className={`text-xs ${
                              msg.sender === 'user' 
                                ? 'text-rose-100' 
                                : 'text-muted-foreground'
                            }`}>
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {/* Message Input — keep above bottom tab bar; safe area for home indicator */}
              <div className="shrink-0 border-t border-rose-200/40 bg-white/95 p-2 pt-2 dark:border-rose-800/40 dark:bg-black/50 sm:p-3 max-lg:pb-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Share your thoughts, dreams, or questions..."
                    className="min-h-11 min-w-0 flex-1 border-rose-200 bg-white/90 text-base focus:border-rose-400 dark:bg-black/50 dark:backdrop-blur-sm sm:min-h-10 sm:text-sm"
                  />
                  <Button
                    type="submit"
                    disabled={!message.trim()}
                    className="h-11 shrink-0 touch-manipulation bg-gradient-to-r from-rose-500 to-pink-500 px-3 hover:from-rose-600 hover:to-pink-600 sm:h-10"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
              <p className="shrink-0 text-center text-xs text-muted-foreground italic sm:text-sm max-lg:hidden">
                "In solitude, we find the strength to love others and ourselves more deeply."
              </p>
              </div>
            </TabsContent>

            {/* Truth or Dare Spinner Tab */}
            <TabsContent value="spinner" className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
              <Card className="border-purple-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
                <CardContent>
                  <TruthOrDareSpinner />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Self Chat System Tab */}
            <TabsContent
              value="selfchat"
              className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain data-[state=inactive]:hidden [-webkit-overflow-scrolling:touch]"
            >
              <Card className="border-blue-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
                <CardContent>
                  <SelfChatSystem />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        {/* Sidebar: order-1 on mobile so it stays above the tab strip, not under it */}
        <div className="order-1 mt-0 w-full space-y-4 max-lg:max-h-36 max-lg:min-h-0 max-lg:overflow-y-auto sm:mt-0 sm:space-y-6 lg:order-2 lg:mt-8 lg:max-h-none lg:w-80">
          {/* Self-Reflection Stats */}
          <Card className="border-rose-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-rose-800 dark:text-rose-200 flex items-center gap-2 text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                Self-Reflection Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Messages Sent</span>
                <span className="font-bold text-rose-600 text-sm sm:text-base">{messages.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Longest Streak</span>
                <span className="font-bold text-rose-600 text-sm sm:text-base">{Math.max(...messages.map(m => (m.text || '').split(' ').length), 0)} words</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">First Message</span>
                <span className="font-bold text-rose-600 text-sm sm:text-base">{messages[0]?.text?.slice(0, 16) || '-'}</span>
              </div>
            </CardContent>
          </Card>
          {/* Quick Prompts */}
          <Card className="border-rose-200/50 bg-white/80 dark:bg-black/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-rose-800 dark:text-rose-200 text-sm sm:text-base">Quick Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {["Gratitude", "Dreams", "Goals", "Fears", "Memories", "Passion"].map((topic) => (
                  <Button
                    key={topic}
                    variant="outline"
                    size="sm"
                    className="text-xs border-rose-200 hover:bg-rose-100 hover:border-rose-300"
                    onClick={() => setMessage(`Let's talk about ${topic.toLowerCase()}`)}
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Footer — desktop only; mobile quote is in chat tab */}
      <div className="text-center p-4 sm:p-6 max-lg:hidden">
        <p className="text-xs sm:text-sm text-muted-foreground italic">
          "In solitude, we find the strength to love others and ourselves more deeply."
        </p>
      </div>
    </div>
  );
};

export default SoloPage;