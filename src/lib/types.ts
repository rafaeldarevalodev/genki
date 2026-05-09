export interface SrsData {
  interval: number;
  repetition: number;
  ef: number;
  nextReview: number;
  status: 'new' | 'learning' | 'review' | 'mastered';
}

export interface Card {
  front: string;
  back: string;
  ipa: string;
  spanish_phonetic: string;
  explanation: string;
  category: 'structure' | 'action' | 'concept' | 'modifier' | 'idiom' | 'filler';
  srs: SrsData;
  voice?: string;
}

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
  createdAt: string;
  sourceText: string;
  sourceImages?: string[];
  cefrLevel?: string;
}

export interface UserProfile {
  level: number;
  xp: number;
}
