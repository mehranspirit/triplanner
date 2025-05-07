import React, { useState, useEffect } from 'react';
import { Trip } from '@/types/eventTypes';
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
import { Textarea } from '@/components/ui/textarea';

interface TripEditModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTrip: Trip) => Promise<void>;
}

const TripEditModal: React.FC<TripEditModalProps> = ({ trip, isOpen, onClose, onUpdate }) => {
  const [name, setName] = useState(trip.name);
  const [description, setDescription] = useState(trip.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(trip.thumbnailUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when trip changes
  useEffect(() => {
    if (isOpen) {
      setName(trip.name);
      setDescription(trip.description || '');
      setThumbnailUrl(trip.thumbnailUrl || '');
      setError(null);
    }
  }, [trip, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Trip name is required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const updatedTrip = {
        ...trip,
        name: name.trim(),
        description: description.trim() || undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined
      };
      
      await onUpdate(updatedTrip);
      onClose();
    } catch (err) {
      console.error('Error updating trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
          <DialogDescription>
            Update your trip details below
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="thumbnail" className="text-right">
                Thumbnail URL
              </Label>
              <Input
                id="thumbnail"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter trip description"
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TripEditModal; 