import React from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  
  // Split text by URLs and map each part
  const parts = text.split(urlPattern);
  
  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return part;
  });
};

interface CollapsibleContentProps {
  content: string;
  label: string;
  isExpanded: boolean;
  isExploring?: boolean;
  className?: string;
}

export const CollapsibleContent: React.FC<CollapsibleContentProps> = ({
  content,
  label,
  isExpanded,
  isExploring,
  className
}) => {
  if (!content) return null;

  return (
    <div className={cn(
      "text-sm transition-all duration-200",
      isExploring ? "text-gray-600" : "text-gray-700",
      !isExpanded && "line-clamp-2",
      className
    )}>
      <span className="font-semibold">{label}: </span>
      {renderTextWithLinks(content)}
    </div>
  );
};

interface ShowMoreButtonProps {
  isExpanded: boolean;
  onClick: () => void;
  isExploring?: boolean;
}

export const ShowMoreButton: React.FC<ShowMoreButtonProps> = ({
  isExpanded,
  onClick,
  isExploring
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "w-full mt-1 text-xs flex items-center justify-center gap-1",
        isExploring ? "text-gray-600 hover:text-gray-900" : "text-gray-500 hover:text-gray-700"
      )}
      onClick={onClick}
    >
      {isExpanded ? (
        <>
          Show less <ChevronUp className="h-3 w-3" />
        </>
      ) : (
        <>
          Show more <ChevronDown className="h-3 w-3" />
        </>
      )}
    </Button>
  );
}; 