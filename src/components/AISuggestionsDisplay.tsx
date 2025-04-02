import React from 'react';
import { XMarkIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

interface AISuggestionsDisplayProps {
  suggestions: string;
  onClose: () => void;
}

export const AISuggestionsDisplay: React.FC<AISuggestionsDisplayProps> = ({
  suggestions,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
          <div className="absolute right-0 top-0 pr-4 pt-4 flex gap-2">
            <button
              onClick={handleCopy}
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="h-6 w-6 text-green-500" />
              ) : (
                <ClipboardIcon className="h-6 w-6" />
              )}
            </button>
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                AI Travel Suggestions
              </h3>
              <div className="mt-2 prose prose-sm max-w-none">
                {suggestions.split('\n').map((line, index) => {
                  // Handle markdown headers
                  if (line.startsWith('#')) {
                    const level = line.match(/^#+/)?.[0].length || 1;
                    const text = line.replace(/^#+\s*/, '');
                    return React.createElement(
                      `h${level}`,
                      { key: index, className: `text-${level === 1 ? 'xl' : level === 2 ? 'lg' : 'md'} font-bold mt-4 mb-2` },
                      text
                    );
                  }
                  // Handle horizontal rules
                  if (line.trim() === '---') {
                    return <hr key={index} className="my-4 border-gray-200" />;
                  }
                  // Handle bullet points
                  if (line.trim().startsWith('-')) {
                    return (
                      <li key={index} className="ml-4 list-disc">
                        {line.replace(/^-\s*/, '')}
                      </li>
                    );
                  }
                  // Regular paragraphs
                  return (
                    <p key={index} className="whitespace-pre-wrap mb-2">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 