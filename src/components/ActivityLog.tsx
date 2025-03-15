import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getActivities, getTripActivities } from '../services/api';
import Avatar from './Avatar';
import { formatDistanceToNow, format } from 'date-fns';

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

const ActivityLog: React.FC<ActivityLogProps> = ({ tripId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = tripId 
          ? await getTripActivities(tripId, page)
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
  }, [tripId, page]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
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
    if (!['event_create', 'event_update', 'event_delete'].includes(activity.actionType)) {
      return null;
    }

    const eventType = activity.details?.eventType || activity.event?.type || 'Event';
    const eventTitle = getEventTitle(activity);
    
    if (activity.actionType === 'event_create') {
      return (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <p className="font-medium">New {eventType}:</p>
          <p>{eventTitle}</p>
          {activity.details?.date && (
            <p>Date: {formatDate(activity.details.date)}</p>
          )}
          {renderEventSpecificDetails(activity)}
        </div>
      );
    }
    
    if (activity.actionType === 'event_update') {
      const changedFields = activity.details?.changedFields || [];
      
      if (changedFields.length === 0) {
        return null;
      }
      
      return (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <p className="font-medium">Updated {eventType}: {eventTitle}</p>
          <p>Changed fields:</p>
          <ul className="list-disc list-inside">
            {changedFields.map((field: string) => (
              <li key={field} className="capitalize">
                {field.replace(/([A-Z])/g, ' $1').trim()}
                {renderFieldChange(activity, field)}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    
    if (activity.actionType === 'event_delete') {
      return (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <p className="font-medium">Deleted {eventType}:</p>
          <p>{eventTitle}</p>
          {activity.details?.date && (
            <p>Date: {formatDate(activity.details.date)}</p>
          )}
        </div>
      );
    }
    
    return null;
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
        return `${activity.details?.airline || ''} ${activity.details?.flightNumber || ''} - ${activity.details?.airport || ''}`;
      case 'stay':
        return activity.details?.accommodationName || 'Accommodation';
      case 'destination':
        return activity.details?.placeName || activity.details?.location || 'Destination';
      default:
        return activity.details?.title || 'Untitled event';
    }
  };
  
  // Helper function to render specific details based on event type
  const renderEventSpecificDetails = (activity: Activity) => {
    const eventType = activity.details?.eventType || activity.event?.type;
    
    if (!eventType) {
      return null;
    }
    
    switch (eventType) {
      case 'arrival':
      case 'departure':
        return (
          <>
            {activity.details?.airline && <p>Airline: {activity.details.airline}</p>}
            {activity.details?.flightNumber && <p>Flight: {activity.details.flightNumber}</p>}
            {activity.details?.airport && <p>Airport: {activity.details.airport}</p>}
            {activity.details?.time && <p>Time: {activity.details.time}</p>}
          </>
        );
      case 'stay':
        return (
          <>
            {activity.details?.accommodationName && <p>Accommodation: {activity.details.accommodationName}</p>}
            {activity.details?.address && <p>Address: {activity.details.address}</p>}
            {activity.details?.checkIn && <p>Check-in: {formatDate(activity.details.checkIn)}</p>}
            {activity.details?.checkOut && <p>Check-out: {formatDate(activity.details.checkOut)}</p>}
          </>
        );
      case 'destination':
        return (
          <>
            {activity.details?.placeName && <p>Place: {activity.details.placeName}</p>}
            {activity.details?.address && <p>Address: {activity.details.address}</p>}
            {activity.details?.description && <p>Description: {activity.details.description}</p>}
          </>
        );
      default:
        return null;
    }
  };
  
  // Helper function to render field changes
  const renderFieldChange = (activity: Activity, field: string) => {
    if (!activity.details?.previousValues || !activity.details?.newValues) {
      return null;
    }
    
    const prevValue = activity.details.previousValues[field];
    const newValue = activity.details.newValues[field];
    
    if (prevValue === undefined || newValue === undefined) {
      return null;
    }
    
    // Format dates if the field appears to be a date
    if (field.toLowerCase().includes('date') || field === 'checkIn' || field === 'checkOut') {
      return (
        <span className="text-xs ml-1">
          from {formatDate(prevValue)} to {formatDate(newValue)}
        </span>
      );
    }
    
    return (
      <span className="text-xs ml-1">
        from "{prevValue}" to "{newValue}"
      </span>
    );
  };
  
  // Helper function to format dates
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
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

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Activity Log
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Recent activities related to your trips
        </p>
      </div>
      
      <div className="border-t border-gray-200">
        <ul className="divide-y divide-gray-200">
          {activities.length === 0 ? (
            <li className="px-4 py-5 sm:px-6">
              <div className="text-center text-gray-500">
                No activities found
              </div>
            </li>
          ) : (
            activities.map((activity) => (
              <li key={activity._id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Avatar 
                      photoUrl={activity.user.photoUrl || null} 
                      name={activity.user.name} 
                      size="md" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {activity.user.name}
                      </p>
                      <div className="flex items-center text-sm text-gray-500">
                        {getActionIcon(activity.actionType)}
                        <span className="ml-1.5">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-900">
                      {activity.description}
                    </p>
                    {renderEventDetails(activity)}
                    <div className="mt-2">
                      <Link 
                        to={`/trips/${activity.trip._id}`} 
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Trip
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