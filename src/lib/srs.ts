import type { Card, Deck } from './types';

// Helper to format duration for UI
export const formatInterval = (days: number): string => {
  if (days <= 0 || days * 24 * 60 < 1) return 'Ahora';
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days === 1) return '1 día';
  if (days < 30) return `${Math.round(days)} días`;
  if (days < 365) return `${(days / 30).toFixed(1)} mes`;
  return `${(days / 365).toFixed(1)} años`;
};

// Preview function to show user what will happen
export const getNextIntervalPreview = (card: Card, quality: number): number => {
  // If Fail (0) or Hard (3), we want immediate review.
  if (quality <= 3) return 0;

  let { interval, repetition, ef } = card.srs || { interval: 0, repetition: 0, ef: 2.5 };
  
  let nextEf = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEf < 1.3) nextEf = 1.3;

  let nextInterval;

  if (repetition === 0) {
    nextInterval = 1;
  } else if (repetition === 1) {
    nextInterval = 6;
  } else {
    nextInterval = Math.round(interval * nextEf);
  }

  if (quality === 5) nextInterval = Math.round(nextInterval * 1.3);

  return nextInterval;
};

export const calculateSm2 = (card: Card, quality: number): Card => {
  // Quality: 0 (Again), 3 (Hard), 4 (Good), 5 (Easy)
  let { interval, repetition, ef } = card.srs || { interval: 0, repetition: 0, ef: 2.5 };
  
  let nextInterval: number;
  let nextRepetition: number;
  let nextEf = ef;
  let nextReviewDate: number;

  if (quality >= 4) { // PASSED (Good / Easy)
    nextEf = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (nextEf < 1.3) nextEf = 1.3;

    nextRepetition = repetition + 1;

    if (repetition === 0) {
      nextInterval = 1;
    } else if (repetition === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * nextEf);
    }

    if (quality === 5) nextInterval = Math.round(nextInterval * 1.3);

    nextReviewDate = Date.now() + nextInterval * 24 * 60 * 60 * 1000;
  } else { // FAILED (Again / Hard)
    if (quality === 0) nextEf = Math.max(1.3, ef - 0.2);
    else nextEf = Math.max(1.3, ef - 0.15);

    nextInterval = 0;
    nextRepetition = 0;
    nextReviewDate = Date.now() + 60000;
  }

  return {
    ...card,
    srs: {
      interval: nextInterval,
      repetition: nextRepetition,
      ef: nextEf,
      nextReview: nextReviewDate,
      status: quality >= 4 ? (nextInterval > 21 ? 'mastered' : 'review') : 'learning',
    },
  };
};

export const getDueCount = (deck: Deck): number => {
  if (!deck.cards) return 0;
  const now = Date.now();
  return deck.cards.filter(
    (c) => !c.srs || !c.srs.nextReview || c.srs.nextReview <= now
  ).length;
};
