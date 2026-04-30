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

export default function FormattedText({ text }: { text: string }) {
  if (typeof text !== 'string') return String(text);
  return (
    <div className="space-y-3">
      {text.split('\n').map((line, i) => (
        <div key={i} className="flex gap-4">
          <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
          <div>{renderBadges(line)}</div>
        </div>
      ))}
    </div>
  );
};
