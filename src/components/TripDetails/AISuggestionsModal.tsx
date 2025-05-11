import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Plus, X, History } from 'lucide-react';
import { generateAISuggestions } from '@/services/aiService';
import { useTrip } from '@/context/TripContext';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { AISuggestionHistory } from '@/types/eventTypes';
import { AISuggestionsHistory } from '@/components/AISuggestionsHistory';

interface AISuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
}

const AISuggestionsModal: React.FC<AISuggestionsModalProps> = ({ 
  isOpen, 
  onClose, 
  tripId,
  tripName 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { state: { trips } } = useTrip();
  const { user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AISuggestionHistory[]>([]);
  
  // Input states
  const [newPlace, setNewPlace] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [additionalPlaces, setAdditionalPlaces] = useState<string[]>([]);
  const [additionalActivities, setAdditionalActivities] = useState<string[]>([]);

  // Load suggestion history
  useEffect(() => {
    if (isOpen && user) {
      loadHistory();
    }
  }, [isOpen, user]);

  const loadHistory = async () => {
    try {
      const suggestions = await api.getAISuggestions(tripId, user?._id || '');
      setHistory(suggestions);
    } catch (error) {
      console.error('Error loading suggestion history:', error);
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    try {
      await api.deleteAISuggestion(suggestionId);
      await loadHistory(); // Reload history after deletion
    } catch (error) {
      console.error('Error deleting suggestion:', error);
    }
  };

  const handleSelectSuggestion = (suggestion: AISuggestionHistory) => {
    setSuggestions(suggestion.suggestions);
    setAdditionalPlaces(suggestion.places);
    setAdditionalActivities(suggestion.activities);
    setShowHistory(false);
  };

  const handleAddPlace = () => {
    if (newPlace.trim()) {
      setAdditionalPlaces(prev => [...prev, newPlace.trim()]);
      setNewPlace('');
    }
  };

  const handleAddActivity = () => {
    if (newActivity.trim()) {
      setAdditionalActivities(prev => [...prev, newActivity.trim()]);
      setNewActivity('');
    }
  };

  const handleRemovePlace = (index: number) => {
    setAdditionalPlaces(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveActivity = (index: number) => {
    setAdditionalActivities(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the current trip
      const trip = trips.find(t => t._id === tripId);
      if (!trip) {
        throw new Error('Trip not found');
      }

      // Get trip dates
      const tripDates = {
        startDate: trip.startDate || trip.events[0]?.startDate || new Date().toISOString(),
        endDate: trip.endDate || trip.events[trip.events.length - 1]?.endDate || new Date().toISOString()
      };

      // Generate AI suggestions using only the manually entered places and activities
      const aiSuggestions = await generateAISuggestions({
        places: additionalPlaces,
        activities: additionalActivities,
        tripDates
      });

      setSuggestions(aiSuggestions);

      // Save the suggestions to history
      await api.saveAISuggestion({
        tripId,
        userId: trip.owner._id,
        places: additionalPlaces,
        activities: additionalActivities,
        suggestions: aiSuggestions,
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error generating suggestions:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  if (showHistory) {
    return (
      <AISuggestionsHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onSelectSuggestion={handleSelectSuggestion}
        onDeleteSuggestion={handleDeleteSuggestion}
        getCreatorInfo={(userId) => {
          if (userId === user?._id) return user;
          const trip = trips.find(t => t._id === tripId);
          if (!trip) return undefined;
          const collaborator = trip.collaborators.find(c => 
            typeof c === 'object' && c.user._id === userId
          );
          return collaborator && typeof collaborator === 'object' ? collaborator.user : undefined;
        }}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>AI Travel Suggestions</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(true)}
              title="View Suggestion History"
            >
              <History className="h-5 w-5" />
            </Button>
          </div>
          <DialogDescription>
            Get personalized suggestions based on your current trip itinerary and interests
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Places Input */}
          <div className="space-y-4">
            <Label>Additional Places of Interest</Label>
            <div className="flex gap-2">
              <Input
                value={newPlace}
                onChange={(e) => setNewPlace(e.target.value)}
                placeholder="Enter a place name"
                onKeyDown={(e) => e.key === 'Enter' && handleAddPlace()}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddPlace}
                disabled={!newPlace.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {additionalPlaces.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {additionalPlaces.map((place, index) => (
                  <div 
                    key={index}
                    className="bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2"
                  >
                    <span className="text-sm">{place}</span>
                    <button
                      onClick={() => handleRemovePlace(index)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activities Input */}
          <div className="space-y-4">
            <Label>Additional Activities of Interest</Label>
            <div className="flex gap-2">
              <Input
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                placeholder="Enter an activity type"
                onKeyDown={(e) => e.key === 'Enter' && handleAddActivity()}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleAddActivity}
                disabled={!newActivity.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {additionalActivities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {additionalActivities.map((activity, index) => (
                  <div 
                    key={index}
                    className="bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2"
                  >
                    <span className="text-sm">{activity}</span>
                    <button
                      onClick={() => handleRemoveActivity(index)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button 
            onClick={handleGenerateSuggestions} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                Generating suggestions...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Suggestions
              </>
            )}
          </Button>
          
          {suggestions && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Suggestions</h3>
              <div className="bg-slate-50 p-4 rounded-md whitespace-pre-wrap prose prose-sm max-w-none">
                {suggestions.split('\n').map((line, index) => {
                  // Handle section headers (numbers followed by dot)
                  if (/^\d+\.\s/.test(line)) {
                    return <h3 key={index} className="text-base font-semibold mt-4 mb-2">{line}</h3>;
                  }
                  // Handle bullet points
                  if (line.trim().startsWith('-')) {
                    return <li key={index} className="ml-4">{line.trim().substring(1).trim()}</li>;
                  }
                  // Regular text
                  return <p key={index} className="my-2">{line}</p>;
                })}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AISuggestionsModal; 