import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles } from 'lucide-react';

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

  const handleGenerateSuggestions = async () => {
    setIsLoading(true);
    try {
      // Placeholder for AI generation
      // This would connect to your actual AI service
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      setSuggestions(`Here are some suggestions for your trip to ${tripName}:
      
1. Visit local restaurants and try the regional specialties
2. Check out museums and cultural sites in the area
3. Consider outdoor activities like hiking or biking
4. Look for local events happening during your stay
5. Don't miss popular tourist attractions`);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Travel Suggestions</DialogTitle>
          <DialogDescription>
            Get personalized suggestions for your trip
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
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
              <div className="bg-slate-50 p-4 rounded-md whitespace-pre-wrap">
                {suggestions}
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