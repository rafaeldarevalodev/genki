'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-cards-from-text.ts';
import '@/ai/flows/simulate-language-roleplay.ts';
import '@/ai/flows/generate-quiz-questions.ts';
import '@/ai/flows/evaluate-roleplay-performance.ts';
import '@/ai/flows/text-to-speech.ts';
import '@/ai/flows/explore-phrase.ts';
import '@/ai/flows/classify-text-cefr.ts';
