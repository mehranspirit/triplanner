import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trip as EventTypesTrip } from '@/types/eventTypes';
import { Trip as IndexTrip } from '@/types/index';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Edit, MoreHorizontal, Sparkles, DollarSign, Download, Users } from 'lucide-react';
import CollaboratorModal from '../CollaboratorModal';
import TripEditModal from './TripEditModal';
import AISuggestionsModal from './AISuggestionsModal';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

// Create conversion functions to bridge the type differences
const convertToIndexTrip = (trip: EventTypesTrip): IndexTrip => {
  // Create a trip that matches the IndexTrip type
  return {
    ...trip,
    // Ensure events is compatible with IndexTrip.events
    events: trip.events.map(event => ({
      ...event,
      // Convert startDate to date field
      date: event.startDate.split('T')[0],
      // Remove startDate and endDate as they're not in IndexTrip.Event
      startDate: undefined,
      endDate: undefined
    }))
  } as unknown as IndexTrip;
};

const convertToEventTypesTrip = (trip: IndexTrip): EventTypesTrip => {
  // Create a trip that matches the EventTypesTrip type
  return {
    ...trip,
    // Ensure events is compatible with EventTypesTrip.events
    events: trip.events.map(event => ({
      ...event,
      // Convert date to startDate and endDate
      startDate: `${event.date}T00:00:00Z`,
      endDate: `${event.date}T23:59:59Z`,
      // Remove date as it's not in EventTypesTrip.Event
      date: undefined
    }))
  } as unknown as EventTypesTrip;
};

interface TripActionsProps {
  trip: EventTypesTrip;
  isOwner: boolean;
  canEdit: boolean;
  onExport: () => void;
  onTripUpdate: (trip: EventTypesTrip) => Promise<void>;
  className?: string;
}

const TripActions: React.FC<TripActionsProps> = ({ 
  trip, 
  isOwner, 
  canEdit, 
  onExport,
  onTripUpdate,
  className = ''
}) => {
  const navigate = useNavigate();
  
  // Modals state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [isAISuggestionsModalOpen, setIsAISuggestionsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Handle delete trip
  const handleDeleteTrip = async () => {
    try {
      await api.deleteTrip(trip._id);
      navigate('/trips');
    } catch (error) {
      console.error('Error deleting trip:', error);
      alert('Failed to delete trip. Please try again.');
    }
  };

  // Handle leave trip
  const handleLeaveTrip = async () => {
    try {
      // Remove current user from collaborators
      const updatedCollaborators = trip.collaborators.filter(
        c => typeof c === 'string' || c.user._id !== trip.owner._id
      );
      
      const updatedTrip = {
        ...trip,
        collaborators: updatedCollaborators
      };
      
      await onTripUpdate(updatedTrip);
      navigate('/trips');
    } catch (error) {
      console.error('Error leaving trip:', error);
      alert('Failed to leave trip. Please try again.');
    }
  };

  // Handler to bridge the types for CollaboratorModal
  const handleCollaboratorUpdate = async (updatedTrip: EventTypesTrip) => {
    await onTripUpdate(updatedTrip);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Mobile view: Dropdown menu */}
      <div className="md:hidden relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-10 h-10 p-0 relative z-50 bg-white hover:bg-gray-50"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 z-50">
            <DropdownMenuLabel>Trip Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* AI Suggestions */}
            <DropdownMenuItem onClick={() => setIsAISuggestionsModalOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>AI Travel Suggestions</span>
            </DropdownMenuItem>
            
            {/* Expenses */}
            <DropdownMenuItem onClick={() => navigate(`/trips/${trip._id}/expenses`)}>
              <DollarSign className="mr-2 h-4 w-4" />
              <span>Manage Expenses</span>
            </DropdownMenuItem>
            
            {/* Edit Trip - only if can edit */}
            {canEdit && (
              <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit Trip</span>
              </DropdownMenuItem>
            )}
            
            {/* Export */}
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              <span>Export Itinerary</span>
            </DropdownMenuItem>
            
            {/* Collaborators */}
            <DropdownMenuItem onClick={() => setIsCollaboratorModalOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              <span>Manage Collaborators</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {/* Delete/Leave Trip */}
            {isOwner ? (
              <DropdownMenuItem onClick={() => setIsDeleteModalOpen(true)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Trip</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setIsLeaveModalOpen(true)} className="text-amber-600">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Leave Trip</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Desktop view: Individual buttons */}
      <div className="hidden md:flex md:space-x-2">
        {/* AI Suggestions button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setIsAISuggestionsModalOpen(true)}
          title="AI Travel Suggestions"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
        
        {/* Expenses button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => navigate(`/trips/${trip._id}/expenses`)}
          title="Manage Expenses"
        >
          <DollarSign className="h-5 w-5" />
        </Button>
        
        {/* Edit Trip button - only if can edit */}
        {canEdit && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsEditModalOpen(true)}
            title="Edit Trip"
          >
            <Edit className="h-5 w-5" />
          </Button>
        )}
        
        {/* Export button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onExport}
          title="Export Itinerary"
        >
          <Download className="h-5 w-5" />
        </Button>
        
        {/* Collaborators button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setIsCollaboratorModalOpen(true)}
          title="Manage Collaborators"
        >
          <Users className="h-5 w-5" />
        </Button>
        
        {/* Delete/Leave Trip button */}
        {isOwner ? (
          <Button 
            variant="destructive" 
            size="icon" 
            onClick={() => setIsDeleteModalOpen(true)}
            title="Delete Trip"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            className="text-amber-600 border-amber-600 hover:bg-amber-50"
            size="icon" 
            onClick={() => setIsLeaveModalOpen(true)}
            title="Leave Trip"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      {/* Delete Trip Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Trip</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trip? This action cannot be undone and all events will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTrip}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Leave Trip Modal */}
      <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Trip</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this trip? You will lose access to all trip details and will need to be invited again to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button variant="secondary" onClick={() => setIsLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveTrip}>
              Leave Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Collaborator Modal */}
      <CollaboratorModal
        trip={trip}
        isOpen={isCollaboratorModalOpen}
        onClose={() => setIsCollaboratorModalOpen(false)}
        onUpdate={handleCollaboratorUpdate}
      />
      
      {/* Trip Edit Modal */}
      {isEditModalOpen && (
        <TripEditModal 
          trip={trip}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={onTripUpdate}
        />
      )}
      
      {/* AI Suggestions Modal */}
      {isAISuggestionsModalOpen && (
        <AISuggestionsModal
          isOpen={isAISuggestionsModalOpen}
          onClose={() => setIsAISuggestionsModalOpen(false)}
          tripId={trip._id}
          tripName={trip.name}
        />
      )}
    </div>
  );
};

export default TripActions; 