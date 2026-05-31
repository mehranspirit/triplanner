import React from 'react';
import { ExternalLink } from 'lucide-react';

export const renderTextWithLinks = (text: string) => {
  if (!text) return null;

  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {part}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return part;
  });
};
