import { useCallback } from 'react';
import { Event, Trip } from '@/types/eventTypes';
import { api } from '@/services/api';

export type EventVoteAction = 'like' | 'dislike' | 'remove';

export const useEventVotes = (
  trip: Trip | null,
  onEventsUpdated: (events: Event[]) => void,
) => {
  const handleVote = useCallback(async (eventId: string, voteType: EventVoteAction) => {
    if (!trip?._id) return;

    const updatedTrip = voteType === 'remove'
      ? await api.removeVote(trip._id, eventId)
      : await api.voteEvent(trip._id, eventId, voteType);

    onEventsUpdated(updatedTrip.events);
  }, [trip?._id, onEventsUpdated]);

  return { handleVote };
};

export const getUserVoteStatus = (event: Event, userId?: string): 'liked' | 'disliked' | null => {
  if (!userId) return null;
  if (event.likes?.includes(userId)) return 'liked';
  if (event.dislikes?.includes(userId)) return 'disliked';
  return null;
};

export const getVoterDisplayNames = (
  event: Event,
  trip: Trip,
  currentUserId?: string,
): { likes: string[]; dislikes: string[] } => {
  const resolveName = (id: string): string => {
    if (id === currentUserId) return 'You';
    if (id === trip.owner._id) return trip.owner.name || 'Trip owner';
    const collaborator = trip.collaborators.find((entry) => (
      typeof entry === 'string' ? entry === id : entry.user._id === id
    ));
    if (typeof collaborator === 'object' && collaborator?.user?.name) {
      return collaborator.user.name;
    }
    return 'Collaborator';
  };

  return {
    likes: (event.likes ?? []).map(resolveName),
    dislikes: (event.dislikes ?? []).map(resolveName),
  };
};
