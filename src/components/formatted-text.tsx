'use client';

import React from 'react';

const renderBadges = (str: string) => {
  if (typeof str !== 'string') return String(str);
  return str.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} className="inline-flex px-2.5 py-0.5 rounded-full text-sm font-black bg-indigo-100 text-indigo-700 mx-1 border border-indigo-200">
          {part.slice(2, -2)}
        </span>
      );
    }
    return part;
  });
};

interface FormattedTextProps {
  text: string;
}

export default function FormattedText({ text }: FormattedTextProps) {
  if (typeof text !== 'string') return String(text);
  
  // Split text from [tip] content
  const tipMatch = text.match(/\[tip\]([\s\S]*?)$/i);
  let mainText = text;
  let tipText: string | null = null;
  
  if (tipMatch) {
    mainText = text.slice(0, tipMatch.index).trim();
    tipText = tipMatch[1].trim();
  }
  
  const lines = mainText.split('\n').filter(line => line.trim());
  
  return (
    <div className="space-y-3">
      {lines.length > 0 ? (
        lines.map((line, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
            <div>{renderBadges(line)}</div>
          </div>
        ))
      ) : (
        <div className="flex gap-4">
          <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
          <div>{renderBadges(mainText)}</div>
        </div>
      )}
      
      {/* Render tip at the end with distinctive styling */}
      {tipText && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div className="text-sm text-amber-800 italic leading-relaxed">
            {tipText}
          </div>
        </div>
      )}
    </div>
  );
}
