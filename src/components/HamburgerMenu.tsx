import React, { useState, useEffect } from "react";
import { Menu, X, Heart, Users, MessageCircle, Share2, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getOnboardingUrl } from "@/config/site";

interface HamburgerMenuProps {
  currentPage: 'solo' | 'multiplayer' | 'ai-companion';
  sessionId?: string;
  onCopySessionId?: () => void;
  onResetCompanion?: () => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ 
  currentPage, 
  sessionId, 
  onCopySessionId,
  onResetCompanion 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const handleNavigation = (page: string) => {
    setIsOpen(false);
    navigate(`/${page}`);
  };

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId).then(() => {
        toast.success('Session code copied to clipboard!');
        if (onCopySessionId) {
          onCopySessionId();
        }
      }).catch(() => {
        toast.error('Failed to copy session code');
      });
    }
    setShowShareDialog(false);
  };

  return (
    <>
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-white hover:bg-purple-700/20 lg:hidden"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[55] lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu Panel */}
          <div
            className="absolute top-0 right-0 h-full w-[min(20rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-w-full bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch]">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Menu
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Navigation Links */}
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-left ${
                    currentPage === 'solo' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleNavigation('solo')}
                >
                  <Heart className="w-4 h-4 mr-3" />
                  Solo Journey
                </Button>
                
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-left ${
                    currentPage === 'multiplayer' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleNavigation('multiplayer')}
                >
                  <Users className="w-4 h-4 mr-3" />
                  Multiplayer
                </Button>
                
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-left ${
                    currentPage === 'ai-companion' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleNavigation('ai-companion-onboarding')}
                >
                  <MessageCircle className="w-4 h-4 mr-3" />
                  AI Companion
                </Button>
              </div>

              {/* Mode Badges */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Current Mode
                </h4>
                <div className="space-y-2">
                  {currentPage === 'solo' && (
                    <Badge variant="secondary" className="w-full justify-center bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Growth Mode
                    </Badge>
                  )}
                  {currentPage === 'multiplayer' && (
                    <Badge variant="secondary" className="w-full justify-center bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      <Users className="w-3 h-3 mr-1" />
                      Connection Mode
                    </Badge>
                  )}
                  {currentPage === 'ai-companion' && (
                    <>
                      <Badge variant="secondary" className="w-full justify-center bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Learning Mode
                      </Badge>
                      <Badge variant="secondary" className="w-full justify-center bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                        <Heart className="w-3 h-3 mr-1" />
                        Empathy Level: High
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Share Button */}
              {sessionId && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Session
                  </h4>
                  <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="default" 
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share Session
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                          🎉 Invite Your Partner
                        </DialogTitle>
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Share your session code and start connecting!
                        </p>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                          <Badge variant="secondary" className="font-mono text-lg px-3 py-1">{sessionId}</Badge>
                          <Button size="sm" onClick={copySessionId} className="ml-auto">
                            <Copy className="w-4 h-4 mr-1" />
                            Copy Code
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Share via:</p>
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              onClick={() => {
                                const onboardingUrl = getOnboardingUrl();
                                const message = encodeURIComponent(`🎉 Join me on Lover's Code!\n\nSession code: ${sessionId}\n\n📱 How to join:\n\n✨ NEW USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign Up" to create your free account\n3. Choose a username, enter your email, and create a password\n4. Once logged in, navigate to Multiplayer\n5. Click "Join Session" and enter the session code: ${sessionId}\n6. Start chatting! 💕\n\n👋 EXISTING USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign In" and enter your credentials\n3. Navigate to Multiplayer\n4. Click "Join Session" and enter the session code: ${sessionId}\n5. Start chatting! 💕\n\nLet's connect and have fun together! 🎉`);
                                window.open(`https://wa.me/?text=${message}`, '_blank');
                              }}
                              className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white font-medium"
                            >
                              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                              WhatsApp
                            </Button>
                            
                            <Button
                              onClick={() => {
                                const onboardingUrl = getOnboardingUrl();
                                const message = `🎉 Join me on Lover's Code!

Session code: ${sessionId}

📱 How to join:

✨ NEW USERS:
1. Go to: ${onboardingUrl}
2. Click "Sign Up" to create your free account
3. Choose a username, enter your email, and create a password
4. Once logged in, navigate to Multiplayer
5. Click "Join Session" and enter the session code: ${sessionId}
6. Start chatting! 💕

👋 EXISTING USERS:
1. Go to: ${onboardingUrl}
2. Click "Sign In" and enter your credentials
3. Navigate to Multiplayer
4. Click "Join Session" and enter the session code: ${sessionId}
5. Start chatting! 💕

Let's connect and have fun together! 🎉`;
                                navigator.clipboard.writeText(message).then(() => {
                                  toast.success('Invitation copied! Paste it in Snapchat to share.');
                                  // Try to open Snapchat web
                                  window.open('https://web.snapchat.com/', '_blank');
                                }).catch(() => {
                                  toast.error('Failed to copy. Please copy the session code manually.');
                                });
                              }}
                              className="w-full bg-[#FFFC00] hover:bg-[#FFE500] text-black font-medium"
                            >
                              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.031c-.012.111-.02.22-.02.31 0 .293.24.534.534.534.11 0 .208-.04.283-.105a.888.888 0 0 0 .224-.38c.279-.78.77-1.317 1.453-1.69.884-.48 1.89-.577 2.87-.577 1.98 0 3.91.88 4.89 2.41.77 1.2.9 2.69.35 4.05-.55 1.35-1.68 2.31-3.12 2.71-.3.09-.62.14-.94.14a4.5 4.5 0 0 1-2.25-.6c-.15-.09-.32-.14-.5-.14-.2 0-.38.06-.53.16l-2.34 1.58c-.36.24-.81.24-1.17 0l-2.34-1.58a.96.96 0 0 0-.53-.16c-.18 0-.35.05-.5.14a4.5 4.5 0 0 1-2.25.6c-.32 0-.64-.05-.94-.14-1.44-.4-2.57-1.36-3.12-2.71-.55-1.36-.42-2.85.35-4.05.98-1.53 2.91-2.41 4.89-2.41.98 0 1.99.1 2.87.58.68.37 1.17.9 1.45 1.69.03.08.08.16.13.24.05.08.1.15.15.21.08.1.18.18.3.24.12.06.25.1.38.1.29 0 .53-.24.53-.53 0-.09-.01-.2-.02-.31l-.003-.03c-.1-1.63-.23-3.66.3-4.85C8.13 1.07 11.22.8 12.21.8zm-1.36 7.99c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              </svg>
                              Snapchat
                            </Button>
                            
                            <Button
                              onClick={() => {
                                const onboardingUrl = getOnboardingUrl();
                                const message = encodeURIComponent(`🎉 Join me on Lover's Code!\n\nSession code: ${sessionId}\n\n📱 How to join:\n\n✨ NEW USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign Up" to create your free account\n3. Choose a username, enter your email, and create a password\n4. Once logged in, navigate to Multiplayer\n5. Click "Join Session" and enter the session code: ${sessionId}\n6. Start chatting! 💕\n\n👋 EXISTING USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign In" and enter your credentials\n3. Navigate to Multiplayer\n4. Click "Join Session" and enter the session code: ${sessionId}\n5. Start chatting! 💕\n\nLet's connect and have fun together! 🎉`);
                                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(onboardingUrl)}&quote=${message}`, '_blank');
                              }}
                              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium"
                            >
                              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              Facebook
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Settings for AI Companion */}
              {currentPage === 'ai-companion' && onResetCompanion && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Settings
                  </h4>
                  <Button 
                    variant="outline" 
                    className="w-full border-pink-300 hover:bg-pink-50 dark:border-pink-700 dark:hover:bg-pink-900/20"
                    onClick={() => {
                      setIsOpen(false);
                      onResetCompanion();
                    }}
                  >
                    Reset Companion
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HamburgerMenu; 