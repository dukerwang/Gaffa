'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export type ChatTabState =
  | { type: 'lobby' }
  | { type: 'futbolpedia' }
  | { type: 'dm'; userId: string; username: string; teamName: string };

export type ViewerClub = { teamId: string; name: string };

/** The channel list, or one open conversation. */
export type ChatView = 'channels' | 'chat';

interface UnreadSummary {
  lobbyUnread: boolean;
  dmUnreadPeerIds: string[];
}

interface LeagueChatContextType {
  leagueId: string;
  isOpen: boolean;
  isMinimized: boolean;
  activeTab: ChatTabState;
  view: ChatView;
  viewerClub: ViewerClub | null;
  unreadSummary: UnreadSummary;
  openChat: (tab?: ChatTabState) => void;
  closeChat: () => void;
  toggleChat: () => void;
  minimizeChat: () => void;
  restoreChat: () => void;
  setActiveTab: (tab: ChatTabState) => void;
  setView: (view: ChatView) => void;
  setViewerClub: (club: ViewerClub | null) => void;
  setUnreadSummary: React.Dispatch<React.SetStateAction<UnreadSummary>>;
}

const LeagueChatContext = createContext<LeagueChatContextType | null>(null);

const RESERVED_SEGMENTS = new Set(['create', 'join']);

export function LeagueChatProvider({
  leagueId: propLeagueId,
  children,
}: {
  leagueId?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Dynamically extract leagueId from route if not explicitly passed as prop
  const derivedLeagueId = useMemo(() => {
    if (propLeagueId) return propLeagueId;
    const match = pathname?.match(/\/league\/([^/]+)/);
    const raw = match ? match[1] : null;
    return raw && !RESERVED_SEGMENTS.has(raw) ? raw : '';
  }, [pathname, propLeagueId]);

  const leagueId = propLeagueId || derivedLeagueId;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTabState>({ type: 'lobby' });
  const [view, setView] = useState<ChatView>('channels');
  const [viewerClub, setViewerClub] = useState<ViewerClub | null>(null);
  const [unreadSummary, setUnreadSummary] = useState<UnreadSummary>({
    lobbyUnread: false,
    dmUnreadPeerIds: [],
  });

  // If the user navigates directly to the dedicated full chat page,
  // close the onscreen widget so there aren't two chats open on screen.
  useEffect(() => {
    if (leagueId && pathname?.startsWith(`/league/${leagueId}/chat`)) {
      setIsOpen(false);
    }
  }, [pathname, leagueId]);

  // Opening the chat lands on the channel list unless the caller names a conversation.
  const openChat = useCallback((tab?: ChatTabState) => {
    if (tab) {
      setActiveTab(tab);
      setView('chat');
    } else {
      setView('channels');
    }
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      if (prev && isMinimized) {
        setIsMinimized(false);
        return true;
      }
      if (!prev) setView('channels');
      return !prev;
    });
  }, [isMinimized]);

  const minimizeChat = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restoreChat = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      leagueId,
      isOpen,
      isMinimized,
      activeTab,
      view,
      viewerClub,
      unreadSummary,
      openChat,
      closeChat,
      toggleChat,
      minimizeChat,
      restoreChat,
      setActiveTab,
      setView,
      setViewerClub,
      setUnreadSummary,
    }),
    [
      leagueId,
      isOpen,
      isMinimized,
      activeTab,
      view,
      viewerClub,
      unreadSummary,
      openChat,
      closeChat,
      toggleChat,
      minimizeChat,
      restoreChat,
    ]
  );

  return <LeagueChatContext.Provider value={value}>{children}</LeagueChatContext.Provider>;
}

export function useLeagueChat() {
  return useContext(LeagueChatContext);
}
