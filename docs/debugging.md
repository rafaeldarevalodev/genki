# Debugging Guide

This guide helps you troubleshoot issues in the Genki app by adding temporary debug logging.

## Quick Debug Template

When you need to debug, add logs using this ASCII box format for readability:

```typescript
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  CATEGORY - TITLE                                        ║');
console.log('╠═══════════════════════════════════════════════════════════╣');
console.log('║  key:', value);
console.log('║  array (first 5):', array.slice(0, 5));
console.log('╚═══════════════════════════════════════════════════════════╝');
```

## Common Debug Scenarios

### 1. Words Appearing Fragmented (interface → in ter face)

**Files to check**: `src/components/analyzed-text.tsx`

**Symptom**: Words in the Analysis page are split incorrectly.

**Debug approach**:
```typescript
// Add before regex split
console.log('║  chunks:', chunks.slice(0, 10));
console.log('║  pattern regex:', pattern.toString());
console.log('║  text split into', parts.length, 'parts');
console.log('║  first 5 parts:', parts.slice(0, 5));
```

**Fix**: Ensure chunks are sorted by length (descending) so longer matches take priority:
```typescript
const chunks = cards.map(c => c.front).filter(Boolean).sort((a, b) => b.length - a.length);
```

---

### 2. Cards Not Appearing After Generation

**Files to check**: 
- `src/app/actions.ts` (Server action)
- `src/ai/flows/generate-cards-from-text.ts` (LLM call)
- `src/contexts/decks-context.tsx` (localStorage save/load)

**Debug approach**:
```typescript
// In generateCardsAction (actions.ts)
console.log('║  result:', result);
console.log('║  cards count:', result.cards?.length);

// In generateCardsFromText (generate-cards-from-text.ts)
console.log('║  LLM response:', content.substring(0, 500));
console.log('║  Parsed cards:', cards?.slice(0, 5));

// In DecksContext (decks-context.tsx)
console.log('║  Loaded decks:', parsedDecks.length);
console.log('║  First deck cards:', parsedDecks[0]?.cards?.length);
```

---

### 3. Deck Not Found on Analysis Page

**Files to check**: 
- `src/app/(app)/creator/analysis/[deckId]/page.tsx`
- `src/contexts/decks-context.tsx`

**Debug approach**:
```typescript
// In AnalysisPage
console.log('║  deckId:', deckId);
console.log('║  found:', !!found);
console.log('║  available deckIds:', decks.map(d => d.id));
console.log('║  first 5 card fronts:', found?.cards.slice(0, 5).map(c => c.front));
```

---

### 4. LLM Returning Empty or Malformed JSON

**Files to check**: `src/ai/flows/generate-cards-from-text.ts`

**Debug approach**:
```typescript
console.log('║  LLM RAW RESPONSE:', content.substring(0, 1000));
console.log('║  JSON MATCH:', jsonMatch?.[0].substring(0, 200));
```

**Common issues**:
- LLM added extra text around JSON → Fix regex in `content.match()`
- JSON syntax error → Check for trailing commas or missing quotes
- Empty response → Check API key and model availability

---

## File Map (by Area)

| Area | File | Purpose |
|------|------|---------|
| **Card Generation** | `src/ai/flows/generate-cards-from-text.ts` | LLM call to generate cards |
| **Server Actions** | `src/app/actions.ts` | Entry point for card generation |
| **State Management** | `src/contexts/decks-context.tsx` | localStorage save/load |
| **Analysis UI** | `src/components/analyzed-text.tsx` | Text display with highlighted cards |
| **Analysis Page** | `src/app/(app)/creator/analysis/[deckId]/page.tsx` | Page routing and deck lookup |
| **Text Cleaning** | `src/utils/text-cleaner.ts` | Pre-process input text |
| **Live Voice** | `src/hooks/useLiveVoice.ts` | Voice conversation with Maya |
| **Live Voice UI** | `src/components/roleplay/live-voice-ui.tsx` | Voice mode UI |
| **Audio Worker** | `src/workers/audio-stream.worker.ts` | Audio playback |

## Key Data Structures

### Card Object
```typescript
interface Card {
  front: string;           // English word/phrase
  back: string;            // Spanish translation + English
  ipa?: string;            // IPA pronunciation
  spanish_phonetic?: string;
  explanation?: string;
  category: 'structure' | 'action' | 'concept' | 'modifier' | 'idiom' | 'filler';
  srs?: SRSData;
  voice?: string;
}
```

### Deck Object
```typescript
interface Deck {
  id: string;
  name: string;
  cards: Card[];
  createdAt: string;
  sourceText: string;
  sourceImages?: string[];
  cefrLevel?: string;
}
```

### LiveVoiceState Object
```typescript
interface LiveVoiceState {
  mode: 'chat' | 'voice';
  vadState: 'idle' | 'listening' | 'speaking' | 'processing';
  userTranscript: string;
  mayaTranscript: string;
  isMayaSpeaking: boolean;
  sessionId: string;
  error: string | null;
}
```

### Debug Live Voice Pipeline
```typescript
// In useLiveVoice.ts
console.log('║  vadState:', state.vadState);
console.log('║  userTranscript:', state.userTranscript);
console.log('║  isMayaSpeaking:', state.isMayaSpeaking);

// Check Maya Live server logs
// tail -f /tmp/maya_live.log

// Test endpoint directly
// curl -X POST http://localhost:8092/v1/voice/conversation \
//   -H "Content-Type: application/json" \
//   -d '{"user_audio": "...", "mode": "fast"}'
```

## Browser Console Logs

Many debug statements log to the **browser console** (not terminal). Open DevTools (F12) → Console tab to see:
- AnalyzedText logs (highlighting logic)
- DecksContext logs (localStorage operations)
- AnalysisPage logs (deck lookup)

## Removing Debug Logs

After debugging, remove all `console.log` statements to keep the codebase clean:

1. Search for `console.log` in the file
2. Remove all debug blocks (lines with box ASCII format)
3. Keep only error handling (`console.error`) if needed

## Performance Tips

- Use `useMemo` for expensive computations (like the regex split in AnalyzedText)
- Avoid logging large objects in production (use `.slice()` to limit output)
- Consider using React DevTools for component state inspection instead of logs
