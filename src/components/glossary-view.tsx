'use client';

import { useState, useMemo } from 'react';
import type { Card } from '@/lib/types';
import type { Deck } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface GlossaryViewProps {
  deck: Deck;
}

type CategoryKey = 'action' | 'structure' | 'concept' | 'modifier' | 'idiom' | 'filler';

const CATEGORY_ORDER: CategoryKey[] = ['action', 'structure', 'concept', 'modifier', 'idiom', 'filler'];

const CATEGORY_CONFIG: Record<CategoryKey, { emoji: string; title: string; description: string; color: string; bgColor: string; borderColor: string }> = {
  action: {
    emoji: '⚡',
    title: 'Acciones',
    description: 'Verbos conjugados, phrasal verbs y expresiones de acción que describen lo que hacemos',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  structure: {
    emoji: '🔗',
    title: 'Estructura',
    description: 'Palabras funcionales que conectan ideas y establecen relaciones gramaticales',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  concept: {
    emoji: '📚',
    title: 'Conceptos',
    description: 'Palabras que representan personas, lugares, cosas o ideas abstractas',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  modifier: {
    emoji: '✨',
    title: 'Modificadores',
    description: 'Palabras que modifican, describen o califican a otras palabras',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  idiom: {
    emoji: '💬',
    title: 'Idiomas',
    description: 'Frases cuyo significado no puede deducirse de las palabras individuales',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  filler: {
    emoji: '🤔',
    title: 'Muletillas',
    description: 'Palabras o expresiones que llenan silencios o expresan emociones en conversación informal',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
};

const CATEGORY_SEARCH_TERMS: Record<CategoryKey, string[]> = {
  action: ['action', 'verbo', 'verbos', 'acciones', 'acc'],
  structure: ['structure', 'estructura', 'conector', 'preposicion', 'articulo', 'str'],
  concept: ['concept', 'concepto', 'conceptos', 'sustantivo', 'noun', 'cnc'],
  modifier: ['modifier', 'modificador', 'modificadores', 'adjetivo', 'adverbio', 'adj', 'mod'],
  idiom: ['idiom', 'idioma', 'idiomas', 'expr', 'idm', 'frase', 'expresion'],
  filler: ['filler', 'muletilla', 'muletillas', 'interjeccion', 'fill'],
};

function matchesSearchTerm(category: CategoryKey, searchLower: string): boolean {
  const terms = CATEGORY_SEARCH_TERMS[category];
  return terms.some(term => term.includes(searchLower) || searchLower.includes(term));
}

export default function GlossaryView({ deck }: GlossaryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const groupedCards = useMemo(() => {
    return deck.cards.reduce((acc, card) => {
      const cat = card.category || 'concept';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(card);
      return acc;
    }, {} as Record<string, Card[]>);
  }, [deck.cards]);

  const filteredGroupedCards = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) {
      return groupedCards;
    }

    const result: Record<string, Card[]> = {};
    
    for (const category of CATEGORY_ORDER) {
      const cards = groupedCards[category] || [];
      
      if (matchesSearchTerm(category, searchLower)) {
        result[category] = cards;
        continue;
      }
      
      const filteredCards = cards.filter(card =>
        card.front.toLowerCase().includes(searchLower) ||
        card.back.toLowerCase().includes(searchLower) ||
        card.explanation.toLowerCase().includes(searchLower)
      );
      
      if (filteredCards.length > 0) {
        result[category] = filteredCards;
      }
    }
    
    return result;
  }, [groupedCards, searchTerm]);

  const hasResults = Object.values(filteredGroupedCards).some(cards => cards.length > 0);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          placeholder="Buscar en glosario... (también busca por categoría: 'verbo', 'concepto', etc.)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 py-4 bg-white rounded-2xl shadow-inner text-base"
        />
      </div>

      {!hasResults && searchTerm && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg font-medium">No se encontraron resultados</p>
          <p className="text-sm mt-2">Prueba buscando por categoría: "verbo", "concepto", "estructura", "modificador", "idioma", "muletilla"</p>
        </div>
      )}

      <div className="space-y-8">
        {CATEGORY_ORDER.map(category => {
          const cards = filteredGroupedCards[category];
          if (!cards || cards.length === 0) return null;
          
          const config = CATEGORY_CONFIG[category];
          
          return (
            <div
              key={category}
              className={`${config.bgColor} rounded-3xl border-2 ${config.borderColor} overflow-hidden`}
            >
              <div className="px-6 py-4 bg-white/80 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{config.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xl font-black uppercase tracking-wide ${config.color}`}>
                        {config.title}
                      </h3>
                      <span className={`text-sm font-bold ${config.color} opacity-60`}>
                        {cards.length} {cards.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${config.color} opacity-70 leading-relaxed`}>
                      {config.description}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {cards.map((card, idx) => (
                  <div
                    key={idx}
                    className="px-6 py-5 hover:bg-white/50 transition-colors"
                  >
                    <div className="flex items-start gap-6">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-lg text-slate-800 mb-1">
                          {card.front}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-code text-indigo-500 text-sm font-medium">
                            {card.ipa || '-'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-medium text-slate-400 italic text-sm">
                            /{card.spanish_phonetic || '-'}/ 
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-600 font-medium">
                          {card.back}
                        </p>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 text-sm italic leading-relaxed">
                          {card.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}