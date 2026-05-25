import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getEventEnd, getEventStart } from '@/utils/eventTime';
import { Clock, MapPin, Phone, Sparkles, Plus, X, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActivityEvent, DestinationEvent, Event, Trip } from '@/types/eventTypes';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

type SelectableEvent = Event & { selected?: boolean };

interface ExploreSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onAddSuggestions: (events: Event[]) => Promise<void>;
}

const ExploreSuggestionsModal: React.FC<ExploreSuggestionsModalProps> = ({
  isOpen,
  onClose,
  trip,
  onAddSuggestions,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'keywords' | 'results'>('keywords');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [addState, setAddState] = useState<'idle' | 'adding' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SelectableEvent[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setStep('keywords');
      setKeywordInput('');
      setKeywords([]);
      setError(null);
      setSuggestions([]);
      setIsGenerating(false);
      setAddState('idle');
    }
  }, [isOpen]);

  const isAdding = addState === 'adding' || addState === 'success';

  const tripDates = (() => {
    const sortedEvents = [...trip.events].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    return {
      startDate: trip.startDate || sortedEvents[0]?.startDate || new Date().toISOString(),
      endDate: trip.endDate || sortedEvents[sortedEvents.length - 1]?.endDate || new Date().toISOString(),
    };
  })();

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (!value) return;
    if (keywords.some(keyword => keyword.toLowerCase() === value.toLowerCase())) {
      setKeywordInput('');
      return;
    }
    setKeywords(prev => [...prev, value]);
    setKeywordInput('');
  };

  const removeKeyword = (index: number) => {
    setKeywords(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!user || keywords.length === 0) {
      setError('Add at least one activity or destination keyword.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generated = await api.generateDestinationSuggestions({
        existingEvents: trip.events,
        tripDates,
        keywords,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl || null,
        },
      });

      if (generated.length === 0) {
        throw new Error('No suggestions were returned. Try different keywords.');
      }

      setSuggestions(generated.map(item => ({ ...item, selected: true })));
      setStep('results');
    } catch (generateError) {
      console.error('Error generating explore suggestions:', generateError);
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSelected = async () => {
    const selected = suggestions.filter(item => item.selected);
    if (selected.length === 0) return;

    setAddState('adding');
    setError(null);

    try {
      await onAddSuggestions(selected);
      setAddState('success');
      window.setTimeout(() => onClose(), 900);
    } catch (addError) {
      console.error('Error adding explore suggestions:', addError);
      setError(addError instanceof Error ? addError.message : 'Failed to add suggestions');
      setAddState('idle');
    }
  };

  const getSuggestionTitle = (suggestion: SelectableEvent) =>
    suggestion.type === 'activity'
      ? (suggestion as ActivityEvent).title
      : (suggestion as DestinationEvent).placeName;

  const getSuggestionAddress = (suggestion: SelectableEvent) =>
    suggestion.type === 'activity'
      ? (suggestion as ActivityEvent).address
      : (suggestion as DestinationEvent).address;

  const getSuggestionContact = (suggestion: SelectableEvent) => {
    if (suggestion.type === 'activity') {
      return (suggestion as ActivityEvent).contactInfo;
    }
    return (suggestion as DestinationEvent).contactInfo;
  };

  const getSuggestionDescription = (suggestion: SelectableEvent) => {
    if (suggestion.type === 'activity') {
      return (suggestion as ActivityEvent).description;
    }
    return (suggestion as DestinationEvent).description;
  };

  const getSuggestionHours = (suggestion: SelectableEvent) =>
    suggestion.type === 'destination'
      ? (suggestion as DestinationEvent).openingHours
      : undefined;

  const formatSuggestionDate = (suggestion: SelectableEvent) => {
    const start = getEventStart(suggestion);
    const end = getEventEnd(suggestion);
    if (!start) return 'Date TBD';

    const startDay = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const endDay = end
      ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      : startDay;
    const startTime = (suggestion as ActivityEvent).startTime;
    const endTime = (suggestion as ActivityEvent).endTime;

    if (endDay === startDay) {
      if (startTime && endTime) {
        return `${format(start, 'MMM d, yyyy')}, ${startTime} - ${endTime}`;
      }
      return format(start, 'MMM d, yyyy');
    }

    if (end) {
      return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
    }

    return format(start, 'MMM d, yyyy');
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isAdding && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {step === 'keywords' ? 'Explore with AI' : 'Review suggestions'}
          </DialogTitle>
          <DialogDescription>
            {step === 'keywords'
              ? 'Add activities or places you want ideas for, like horseback riding, hikes, or museums.'
              : 'Pick the real venues and activities you want to add to your trip as exploring events.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'keywords' ? (
          <div className="space-y-4 overflow-y-auto py-1">
            <div className="space-y-2">
              <Label htmlFor="explore-keyword">Activity or destination</Label>
              <div className="flex gap-2">
                <Input
                  id="explore-keyword"
                  value={keywordInput}
                  onChange={event => setKeywordInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="e.g. horseback riding, hikes, food tours"
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="rounded-full p-0.5 hover:bg-slate-200"
                      aria-label={`Remove ${keyword}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1 pr-1">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`explore-suggestion-${index}`}
                    checked={Boolean(suggestion.selected)}
                    disabled={isAdding}
                    onChange={event => {
                      setSuggestions(prev =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, selected: event.target.checked } : item
                        )
                      );
                    }}
                    className="mt-1"
                  />
                  <label htmlFor={`explore-suggestion-${index}`} className="min-w-0 flex-1 space-y-2">
                    <div>
                      <h4 className="font-medium text-slate-950">{getSuggestionTitle(suggestion)}</h4>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {suggestion.type === 'activity'
                          ? (suggestion as ActivityEvent).activityType || 'Activity'
                          : 'Destination'}
                      </p>
                    </div>

                    {getSuggestionDescription(suggestion) && (
                      <p className="text-sm text-slate-600">{getSuggestionDescription(suggestion)}</p>
                    )}

                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>{formatSuggestionDate(suggestion)}</span>
                      </div>
                      {getSuggestionAddress(suggestion) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{getSuggestionAddress(suggestion)}</span>
                        </div>
                      )}
                      {getSuggestionContact(suggestion) && (
                        <div className="flex items-start gap-2">
                          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{getSuggestionContact(suggestion)}</span>
                        </div>
                      )}
                      {getSuggestionHours(suggestion) && (
                        <p>
                          <span className="font-medium text-slate-700">Hours:</span>{' '}
                          {getSuggestionHours(suggestion)}
                        </p>
                      )}
                      {suggestion.notes && (
                        <p>
                          <span className="font-medium text-slate-700">Notes:</span> {suggestion.notes}
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'keywords' ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isGenerating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating || keywords.length === 0}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate suggestions'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('keywords')} disabled={isAdding}>
                Back
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={!suggestions.some(item => item.selected) || isAdding}
                className={addState === 'success' ? 'bg-green-600 hover:bg-green-600' : undefined}
              >
                {addState === 'adding' && (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                )}
                {addState === 'success' && (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Added!
                  </>
                )}
                {addState === 'idle' && 'Add selected'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExploreSuggestionsModal;
