'use client';

import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Deck, Card, UserProfile } from '@/lib/types';
import { calculateSm2 } from '@/lib/srs';

const XP_PER_LEVEL_BASE = 100;

interface DecksContextType {
  decks: Deck[];
  isLoaded: boolean;
  addDeck: (deck: Deck) => void;
  deleteDeck: (deckId: string) => void;
  updateCardSrs: (deckId: string, cardIndex: number, quality: number) => Card;
  importDecks: (newDecks: Deck[]) => void;
  userProfile: UserProfile;
  addXp: (points: number) => void;
  xpToNextLevel: number;
}

export const DecksContext = createContext<DecksContextType | undefined>(undefined);

export const DecksProvider = ({ children }: { children: ReactNode }) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ level: 1, xp: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedDecks = localStorage.getItem('genki_decks');
      if (savedDecks) {
        setDecks(JSON.parse(savedDecks));
      }
      const savedProfile = localStorage.getItem('genki_user_profile');
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      }
    } catch (error) {
      console.error('Failed to load data from localStorage', error);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('genki_decks', JSON.stringify(decks));
        localStorage.setItem('genki_user_profile', JSON.stringify(userProfile));
      } catch (error) {
        console.error('Failed to save data to localStorage', error);
      }
    }
  }, [decks, userProfile, isLoaded]);

  const addDeck = useCallback((deck: Deck) => {
    setDecks((prev) => [deck, ...prev]);
  }, []);
  
  const importDecks = useCallback((newDecks: Deck[]) => {
    setDecks((prev) => [...newDecks, ...prev]);
  }, []);

  const deleteDeck = useCallback((deckId: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
  }, []);

  const updateCardSrs = useCallback((deckId: string, cardIndex: number, quality: number) => {
    let foundDeck: Deck | null = null;
    let updatedCard: Card | null = null;
    
    setDecks((prev) => {
      const newDecks = [...prev];
      const deckIdx = newDecks.findIndex(d => d.id === deckId);
      
      if (deckIdx === -1) {
        console.error('[updateCardSrs] Deck not found:', deckId, 'Available decks:', prev.map(d => d.id));
        return prev;
      }
      
      foundDeck = newDecks[deckIdx];
      const cardCount = foundDeck.cards.length;
      
      if (cardIndex < 0 || cardIndex >= cardCount) {
        console.error('[updateCardSrs] Card index out of bounds:', cardIndex, 'deck cards:', cardCount);
        // Don't crash, just return the deck as-is
        return prev;
      }
      
      const cardToUpdate = foundDeck.cards[cardIndex];
      if (!cardToUpdate) {
        console.error('[updateCardSrs] Card is undefined at index:', cardIndex);
        return prev;
      }
      
      updatedCard = calculateSm2(cardToUpdate, quality);
      const newCards = [...foundDeck.cards];
      newCards[cardIndex] = updatedCard;
      newDecks[deckIdx] = { ...foundDeck, cards: newCards };
      
      console.log('[updateCardSrs] Updated card:', cardIndex, 'quality:', quality, 'nextReview:', updatedCard.srs.nextReview);
      
      return newDecks;
    });
    
    return updatedCard;
  }, []);
  
  const addXp = useCallback((points: number) => {
    setUserProfile(currentProfile => {
      let newXp = currentProfile.xp + points;
      let newLevel = currentProfile.level;
      let xpToNextLevel = newLevel * XP_PER_LEVEL_BASE;

      while (newXp >= xpToNextLevel) {
        newLevel++;
        newXp -= xpToNextLevel;
        xpToNextLevel = newLevel * XP_PER_LEVEL_BASE;
        // Future: Add a toast here for level up
      }
      
      return { level: newLevel, xp: newXp };
    });
  }, []);
  
  const xpToNextLevel = userProfile.level * XP_PER_LEVEL_BASE;

  const value = { decks, isLoaded, addDeck, deleteDeck, updateCardSrs, importDecks, userProfile, addXp, xpToNextLevel };

  return (
    <DecksContext.Provider value={value}>
      {children}
    </DecksContext.Provider>
  );
};
