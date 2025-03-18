import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getActivities, getTripActivities } from '../services/api';
import { api } from '../services/api';
import Avatar from './Avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { Trip } from '../types';

interface Activity {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    photoUrl?: string;
  };
  trip: {
    _id: string;
    name: string;
    description?: string;
  };
  event?: {
    _id: string;
    title?: string;
    type?: string;
    id?: string;
  };
  actionType: string;
  description: string;
  details: Record<string, any>;
  createdAt: string;
}

interface ActivityLogProps {
  tripId?: string; // Optional: if provided, only show activities for this trip
}

type FilterType = 'all' | 'self' | 'others';

// New API functions for admin operations
const deleteActivity = async (activityId: string): Promise<void> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/activities/${activityId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete activity');
    }
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
};

const clearTripActivities = async (tripId: string): Promise<void> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/activities/trip/${tripId}/clear`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to clear trip activities');
    }
  } catch (error) {
    console.error('Error clearing trip activities:', error);
    throw error;
  }
};

const ActivityLog: React.FC<ActivityLogProps> = ({ tripId }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(tripId || null);
  const [tripsLoading, setTripsLoading] = useState<boolean>(false);
  const [showTripFilter, setShowTripFilter] = useState<boolean>(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState<boolean>(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // Check if user is the main admin
  const isMainAdmin = user?.email === 'mehran.rajaian@gmail.com';

  // Fetch trips for the filter dropdown
  useEffect(() => {
    // If a tripId is provided as a prop, we don't need to fetch all trips
    if (tripId) return;
    
    const fetchTrips = async () => {
      try {
        setTripsLoading(true);
        const fetchedTrips = await api.getTrips();
        setTrips(fetchedTrips);
      } catch (err) {
        console.error('Error fetching trips for filter:', err);
      } finally {
        setTripsLoading(false);
      }
    };

    fetchTrips();
  }, [tripId]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        // If we have a selectedTripId (either from props or from filter), use that
        const effectiveTripId = selectedTripId || tripId;
        const response = effectiveTripId 
          ? await getTripActivities(effectiveTripId, page)
          : await getActivities(page);
        
        if (page === 1) {
          setActivities(response.activities);
        } else {
          setActivities(prev => [...prev, ...response.activities]);
        }
        
        setHasMore(page < response.pagination.pages);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
    // Reset page when tripId or selectedTripId changes
    setPage(1);
  }, [tripId, selectedTripId, page]);

  // Apply filters whenever activities or filter changes
  useEffect(() => {
    if (!user) {
      setFilteredActivities(activities);
      return;
    }

    let filtered = activities;
    
    if (filter === 'self') {
      filtered = activities.filter(activity => activity.user._id === user._id);
    } else if (filter === 'others') {
      filtered = activities.filter(activity => activity.user._id !== user._id);
    }
    
    setFilteredActivities(filtered);
  }, [activities, filter, user]);

  // Clear action message after 5 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => {
        setActionMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleTripFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedTripId(value === 'all' ? null : value);
    setPage(1); // Reset to first page when changing filter
  };

  const clearTripFilter = () => {
    setSelectedTripId(null);
    setPage(1);
  };

  const handleDeleteActivity = async (activityId: string) => {
    setActivityToDelete(activityId);
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return;
    
    try {
      setActionInProgress(true);
      await deleteActivity(activityToDelete);
      
      // Remove the deleted activity from state
      setActivities(prev => prev.filter(a => a._id !== activityToDelete));
      setActionMessage({ text: 'Activity deleted successfully', type: 'success' });
    } catch (err) {
      setActionMessage({ 
        text: err instanceof Error ? err.message : 'Failed to delete activity', 
        type: 'error' 
      });
    } finally {
      setActivityToDelete(null);
      setActionInProgress(false);
    }
  };

  const handleClearTripActivities = () => {
    setShowClearConfirmation(true);
  };

  const confirmClearTripActivities = async () => {
    const effectiveTripId = selectedTripId || tripId;
    if (!effectiveTripId) return;
    
    try {
      setActionInProgress(true);
      await clearTripActivities(effectiveTripId);
      
      // Clear activities from state
      setActivities([]);
      setActionMessage({ text: 'Activity log cleared successfully', type: 'success' });
    } catch (err) {
      setActionMessage({ 
        text: err instanceof Error ? err.message : 'Failed to clear activity log', 
        type: 'error' 
      });
    } finally {
      setShowClearConfirmation(false);
      setActionInProgress(false);
    }
  };

  // Helper function to get action icon
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'trip_create':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
          </svg>
        );
      case 'trip_update':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        );
      case 'trip_delete':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'event_create':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        );
      case 'event_update':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        );
      case 'event_delete':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        );
      case 'event_like':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
          </svg>
        );
      case 'event_dislike':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
          </svg>
        );
      case 'event_vote_remove':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        );
      case 'collaborator_add':
        case 'collaborator_remove':
        case 'collaborator_role_change':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Helper function to render event details
  const renderEventDetails = (activity: Activity) => {
    const voteActions = ['event_like', 'event_dislike', 'event_vote_remove'];
    const eventActions = ['event_create', 'event_update', 'event_delete'];
    
    if (![...eventActions, ...voteActions].includes(activity.actionType)) {
      return null;
    }

    // For vote actions, show event name and type
    if (voteActions.includes(activity.actionType)) {
      const eventName = activity.details?.eventName || activity.event?.title || 'Event';
      const eventType = activity.details?.eventType || activity.event?.type || '';
      
      let actionText = '';
      if (activity.actionType === 'event_like') {
        actionText = 'Liked';
      } else if (activity.actionType === 'event_dislike') {
        actionText = 'Disliked';
      } else if (activity.actionType === 'event_vote_remove') {
        actionText = 'Removed vote for';
      }
      
      return (
        <span className="ml-1 text-gray-500">
          <span className="text-gray-400">•</span> {actionText} <strong>{eventName}</strong> {eventType && `(${eventType})`}
        </span>
      );
    }

    // For regular event actions
    const eventType = activity.details?.eventType || activity.event?.type || 'Event';
    const eventTitle = getEventTitle(activity);
    
    // Don't show redundant information that's already in the description
    if (activity.description.includes(eventTitle)) {
      // If the title is already in the description, just show the date if available
      return activity.details?.date ? (
        <span className="ml-1 text-gray-500">
          <span className="text-gray-400">•</span> {formatDate(activity.details.date, true)}
        </span>
      ) : null;
    }

    if (activity.actionType === 'event_update') {
      const changedFields = activity.details?.changedFields || [];
      
      if (changedFields.length === 0) {
        return null;
      }
      
      // Only show changed fields if they're not already mentioned in the description
      if (!activity.description.includes('changed:')) {
        return (
          <span className="ml-1 text-gray-500">
            <span className="text-gray-400">•</span> {eventTitle} 
            {activity.details?.date && ` (${formatDate(activity.details.date, true)})`}
            <span className="text-gray-400 ml-1">
              • {changedFields.slice(0, 2).join(', ')}
              {changedFields.length > 2 && '...'}
            </span>
            {/* Show creator info if available and different from the activity user */}
            {activity.details?.event?.createdBy && 
              activity.details.event.createdBy._id !== activity.user._id && (
              <span className="text-gray-400 ml-1">
                • Created by {activity.details.event.createdBy.name}
              </span>
            )}
          </span>
        );
      } else {
        return (
          <span className="ml-1 text-gray-500">
            <span className="text-gray-400">•</span> {eventTitle}
            {activity.details?.date && ` (${formatDate(activity.details.date, true)})`}
            {/* Show creator info if available and different from the activity user */}
            {activity.details?.event?.createdBy && 
              activity.details.event.createdBy._id !== activity.user._id && (
              <span className="text-gray-400 ml-1">
                • Created by {activity.details.event.createdBy.name}
              </span>
            )}
          </span>
        );
      }
    }

    // For create and delete, show the title and date
    return (
      <span className="ml-1 text-gray-500">
        <span className="text-gray-400">•</span> {eventTitle}
        {activity.details?.date && ` (${formatDate(activity.details.date, true)})`}
        {/* For delete events, show creator if available */}
        {activity.actionType === 'event_delete' && 
         activity.details?.createdBy && 
         activity.details.createdBy._id !== activity.user._id && (
          <span className="text-gray-400 ml-1">
            • Created by {activity.details.createdBy.name}
          </span>
        )}
      </span>
    );
  };
  
  // Helper function to get event title based on event type
  const getEventTitle = (activity: Activity) => {
    const eventType = activity.details?.eventType || activity.event?.type;
    
    if (!eventType) {
      return activity.details?.title || 'Untitled event';
    }
    
    switch (eventType) {
      case 'arrival':
      case 'departure':
        // Clean up empty parts
        const airline = activity.details?.airline || '';
        const flightNumber = activity.details?.flightNumber || '';
        const airport = activity.details?.airport || '';
        
        if (!airline && !flightNumber && !airport) {
          return eventType.charAt(0).toUpperCase() + eventType.slice(1);
        }
        
        const parts = [];
        if (airline) parts.push(airline);
        if (flightNumber) parts.push(flightNumber);
        if (parts.length > 0 && airport) {
          return `${parts.join(' ')} - ${airport}`;
        } else if (airport) {
          return airport;
        } else {
          return parts.join(' ');
        }
        
      case 'stay':
        return activity.details?.accommodationName || 'Accommodation';
      case 'destination':
        return activity.details?.placeName || activity.details?.location || 'Destination';
      default:
        return activity.details?.title || 'Untitled event';
    }
  };
  
  // Helper function to format dates
  const formatDate = (dateString: string, compact: boolean = false) => {
    try {
      return compact 
        ? format(new Date(dateString), 'MMM d, yyyy')
        : format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error && activities.length === 0) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading activities</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedTrip = trips.find(t => t._id === selectedTripId);
  const effectiveTripId = selectedTripId || tripId;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden relative">
      {/* Action message toast */}
      {actionMessage && (
        <div className={`absolute top-2 right-2 z-50 px-4 py-2 rounded-md shadow-md ${
          actionMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {actionMessage.text}
        </div>
      )}
      
      {/* Delete confirmation modal */}
      {activityToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete this activity? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setActivityToDelete(null)}
                disabled={actionInProgress}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteActivity}
                disabled={actionInProgress}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {actionInProgress ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Clear confirmation modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Clear Activity Log</h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to clear all activities for {selectedTrip ? `the trip "${selectedTrip.name}"` : 'this trip'}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowClearConfirmation(false)}
                disabled={actionInProgress}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearTripActivities}
                disabled={actionInProgress}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {actionInProgress ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="px-4 py-5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Activity Log
              {selectedTrip && (
                <span className="ml-2 text-sm text-gray-500">
                  for <span className="font-medium text-indigo-600">{selectedTrip.name}</span>
                  <button 
                    onClick={clearTripFilter}
                    className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    (clear)
                  </button>
                </span>
              )}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Recent activities related to your trips
              {isMainAdmin && effectiveTripId && (
                <button
                  onClick={handleClearTripActivities}
                  disabled={actionInProgress}
                  className="ml-3 px-2 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  {actionInProgress ? 'Clearing...' : 'Clear All Activities'}
                </button>
              )}
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            {!tripId && (
              <div className="relative">
                <select
                  value={selectedTripId || 'all'}
                  onChange={handleTripFilterChange}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  disabled={tripsLoading}
                >
                  <option value="all">All Trips</option>
                  {trips.map(trip => (
                    <option key={trip._id} value={trip._id}>
                      {trip.name}
                    </option>
                  ))}
                </select>
                {tripsLoading && (
                  <div className="absolute right-3 top-2">
                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
            )}
            
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                  filter === 'all' 
                    ? 'bg-indigo-600 text-white border-indigo-600 z-10' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('self')}
                className={`relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 text-sm font-medium ${
                  filter === 'self' 
                    ? 'bg-indigo-600 text-white border-indigo-600 z-10' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                My Activities
              </button>
              <button
                type="button"
                onClick={() => setFilter('others')}
                className={`relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                  filter === 'others' 
                    ? 'bg-indigo-600 text-white border-indigo-600 z-10' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Others' Activities
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200">
        <ul className="divide-y divide-gray-200">
          {filteredActivities.length === 0 ? (
            <li className="px-4 py-5 sm:px-6">
              <div className="text-center text-gray-500">
                {loading ? 'Loading activities...' : 'No activities found'}
              </div>
            </li>
          ) : (
            filteredActivities.map((activity) => (
              <li key={activity._id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 relative group">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Avatar 
                      photoUrl={activity.user.photoUrl || null} 
                      name={activity.user.name} 
                      size="md" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {activity.user._id === user?._id ? 'You' : activity.user.name}
                      </p>
                      <div className="flex items-center text-sm text-gray-500">
                        {getActionIcon(activity.actionType)}
                        <span className="ml-1.5">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </span>
                        {isMainAdmin && (
                          <button
                            onClick={() => handleDeleteActivity(activity._id)}
                            className="ml-2 p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-opacity"
                            title="Delete activity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-900">
                        {activity.description}
                        {renderEventDetails(activity)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center">
                      <span className="text-xs text-gray-500 mr-2">
                        Trip: {activity.trip.name}
                      </span>
                      <Link 
                        to={`/trips/${activity.trip._id}`} 
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
        
        {hasMore && (
          <div className="px-4 py-4 sm:px-6 border-t border-gray-200">
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog; 