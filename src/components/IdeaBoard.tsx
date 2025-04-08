import React, { useState, useEffect } from 'react';
import { TripIdea as TripIdeaType } from '../types/dreamTripTypes';
import { TripIdea } from './TripIdea';
import { dreamTripService } from '../services/dreamTripService';
import { DropResult } from 'react-beautiful-dnd';

interface IdeaBoardProps {
  ideas: TripIdeaType[];
  onUpdateIdeas: (ideas: TripIdeaType[]) => void;
  onEditIdea: (idea: TripIdeaType) => void;
  onDeleteIdea: (ideaId: string) => void;
  tripId: string;
}

type ColumnId = 'maybe' | 'interested' | 'must-do';

interface Columns {
  'maybe': TripIdeaType[];
  'interested': TripIdeaType[];
  'must-do': TripIdeaType[];
}

export const IdeaBoard: React.FC<IdeaBoardProps> = ({
  ideas,
  onUpdateIdeas,
  onEditIdea,
  onDeleteIdea,
  tripId
}) => {
  const [columns, setColumns] = useState<Columns>({
    'maybe': ideas.filter(idea => idea.priority === 1),
    'interested': ideas.filter(idea => idea.priority === 2),
    'must-do': ideas.filter(idea => idea.priority === 3)
  });

  // Update columns when ideas prop changes
  useEffect(() => {
    setColumns({
      'maybe': ideas.filter(idea => idea.priority === 1),
      'interested': ideas.filter(idea => idea.priority === 2),
      'must-do': ideas.filter(idea => idea.priority === 3)
    });
  }, [ideas]);

  const handlePriorityChange = async (ideaId: string, newPriority: 1 | 2 | 3) => {
    try {
      // Update the idea on the server
      await dreamTripService.updateIdea(tripId, ideaId, {
        _id: ideaId,
        priority: newPriority
      });

      // Update parent component with the new idea
      const updatedIdeas = ideas.map(i => 
        i._id === ideaId ? { ...i, priority: newPriority } : i
      );
      onUpdateIdeas(updatedIdeas);

      // Update local columns state
      setColumns({
        'maybe': updatedIdeas.filter(idea => idea.priority === 1),
        'interested': updatedIdeas.filter(idea => idea.priority === 2),
        'must-do': updatedIdeas.filter(idea => idea.priority === 3)
      });
    } catch (error) {
      console.error('Failed to update idea priority:', error);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const sourceIndex = source.index;
    const destinationIndex = destination.index;

    // Get the idea being moved
    const idea = ideas.find(i => i._id === draggableId);
    if (!idea) return;

    // Calculate new priority based on destination
    const newPriority = destination.droppableId === 'must-do' ? 3 :
                        destination.droppableId === 'interested' ? 2 : 1;

    // Update local state immediately
    const updatedIdeas = Array.from(ideas);
    const [removed] = updatedIdeas.splice(sourceIndex, 1);
    updatedIdeas.splice(destinationIndex, 0, { ...removed, priority: newPriority });
    onUpdateIdeas(updatedIdeas);

    try {
      // Update on server
      await dreamTripService.updateIdea(tripId, draggableId, {
        _id: draggableId,
        priority: newPriority
      });
    } catch (error) {
      console.error('Failed to update idea priority:', error);
      // Revert on error
      onUpdateIdeas(ideas);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Object.entries(columns).map(([columnId, columnIdeas]) => (
        <div key={columnId} className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
            {columnId.replace('-', ' ')}
          </h3>
          <div className="space-y-4 min-h-[200px]">
            {columnIdeas.map((idea: TripIdeaType) => (
              <TripIdea
                key={idea._id}
                idea={idea}
                onEdit={onEditIdea}
                onDelete={onDeleteIdea}
                onPriorityChange={handlePriorityChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}; 