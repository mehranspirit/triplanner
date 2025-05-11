import React, { useState } from 'react';
import { AISuggestionHistory, User } from '@/types/eventTypes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { Trash2, Eye, Clock, User as UserIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISuggestionsHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  history: AISuggestionHistory[];
  onSelectSuggestion: (suggestion: AISuggestionHistory) => void;
  onDeleteSuggestion: (suggestionId: string) => Promise<void>;
  getCreatorInfo: (userId: string) => User | undefined;
}

export const AISuggestionsHistory: React.FC<AISuggestionsHistoryProps> = ({
  isOpen,
  onClose,
  history,
  onSelectSuggestion,
  onDeleteSuggestion,
  getCreatorInfo,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (suggestionId: string) => {
    setDeletingId(suggestionId);
    try {
      await onDeleteSuggestion(suggestionId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Previous AI Suggestions</DialogTitle>
          <DialogDescription>
            View and manage your previous AI-generated suggestions
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {history.map((item) => {
              const creator = getCreatorInfo(item.userId);
              const isDeleting = deletingId === item._id;
              return (
                <div
                  key={item._id}
                  className={cn(
                    "group relative border rounded-lg p-4 transition-all duration-200",
                    "hover:shadow-md hover:border-gray-300",
                    "bg-gradient-to-br from-white to-gray-50/50",
                    isDeleting && "opacity-50"
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div 
                      className={cn(
                        "flex-1 cursor-pointer space-y-3",
                        isDeleting && "pointer-events-none"
                      )}
                      onClick={() => onSelectSuggestion(item)}
                    >
                      {/* Header with date and creator */}
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {format(new Date(item.createdAt), 'MMM d, yyyy')}
                        </div>
                        {creator && (
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="h-4 w-4" />
                            {creator.name}
                          </div>
                        )}
                      </div>

                      {/* Places */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Places</h4>
                        <div className="flex flex-wrap gap-2">
                          {item.places.map((place, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                            >
                              {place}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Activities */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Activities</h4>
                        <div className="flex flex-wrap gap-2">
                          {item.activities.map((activity, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"
                            >
                              {activity}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSuggestion(item);
                        }}
                        title="View suggestion"
                        disabled={isDeleting}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item._id);
                        }}
                        title="Delete suggestion"
                        className={cn(
                          "text-red-600 hover:text-red-700 hover:bg-red-50",
                          isDeleting && "pointer-events-none"
                        )}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {history.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No previous suggestions found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}; 