/**
 * Clean and normalize text before sending to LLM
 * Removes invisible characters, HTML entities, and normalizes whitespace
 * 
 * This prevents word fragmentation caused by:
 * - Zero-width spaces (U+200B, U+200C, U+200D)
 * - HTML entities (&nbsp;, &amp;, etc.)
 * - Control characters
 * - Non-breaking spaces
 */
export function cleanText(text: string): string {
  let cleaned = text;

  // 1. Zero-width characters (U+200B to U+200D, U+FEFF)
  // These are invisible and can break word boundaries
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. HTML entities (&nbsp;, &amp;, &lt;, &gt;, &#...;)
  cleaned = cleaned.replace(/&[a-z]+;/gi, ' ');
  cleaned = cleaned.replace(/&#x?[0-9a-f]+;/gi, ' ');

  // 3. Control characters (TAB, LF, CR, etc. but keep spaces)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. Normalize multiple spaces to single space
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // 5. Normalize line breaks (keep single space)
  cleaned = cleaned.replace(/[\r\n]+/g, ' ');

  // 6. Remove non-breaking spaces
  cleaned = cleaned.replace(/\u00A0/g, ' ');

  // 7. Trim whitespace at start and end
  cleaned = cleaned.trim();

  return cleaned;
}