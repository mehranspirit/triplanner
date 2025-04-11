import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DreamTrip, TripIdea as TripIdeaType, CreateTripIdeaData, CategoryType, SubCategoryType } from '../types/dreamTripTypes';
import { dreamTripService } from '../services/dreamTripService';
import { EditDreamTripForm } from './EditDreamTripForm';
import { IdeaBoard } from './IdeaBoard';
import { CollaboratorManagementModal } from './CollaboratorManagementModal';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { DreamTripAISuggestionsModal } from './DreamTripAISuggestionsModal';
import { AISuggestionsDisplay } from './AISuggestionsDisplay';
import { generateDreamTripSuggestions } from '../services/aiService';
import { AISuggestionHistory } from '@/types/eventTypes';
import { SparklesIcon, PencilIcon, TrashIcon, ArrowRightOnRectangleIcon, UserGroupIcon } from '@heroicons/react/24/outline';

// Predefined fallback images for ideas
const FALLBACK_IMAGES = {
  places: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  transportation: 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=800',
  accommodation: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800',
  activities: 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=800',
  'arts-culture': 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=800',
  'food-drink': 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800',
  entertainment: 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=800',
  default: 'https://images.pexels.com/photos/1051073/pexels-photo-1051073.jpeg?auto=compress&cs=tinysrgb&w=800'
};

const isCollaboratorObject = (c: string | { user: User; role: 'viewer' | 'editor' } | null | undefined): c is { user: User; role: 'viewer' | 'editor' } => {
  return typeof c === 'object' && c !== null && 'user' in c && 'role' in c && 
    typeof c.user === 'object' && c.user !== null && '_id' in c.user;
};

const DreamTripDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState<DreamTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [showEditIdeaModal, setShowEditIdeaModal] = useState(false);
  const [showDeleteIdeaModal, setShowDeleteIdeaModal] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<TripIdeaType | null>(null);
  const [newIdea, setNewIdea] = useState<CreateTripIdeaData>({
    title: '',
    location: { name: '', lat: 0, lng: 0 },
    sources: [],
    notes: '',
    priority: 2,
    images: [],
    position: { x: 0, y: 0 },
    category: 'places',
    subCategory: 'city'
  });
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [isAISuggestionsModalOpen, setIsAISuggestionsModalOpen] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<string | null>(null);
  const [suggestionsHistory, setSuggestionsHistory] = useState<AISuggestionHistory[]>([]);

  const subCategories: SubCategoryType = {
    transportation: 'flight',
    accommodation: 'hotel',
    activities: 'point-of-interest',
    'arts-culture': 'museum',
    'food-drink': 'restaurant',
    entertainment: 'tour',
    places: 'city'
  };

  const categoryLabels: Record<CategoryType, string> = {
    transportation: 'Getting Around',
    accommodation: 'Staying Over',
    activities: 'Things to Do',
    'arts-culture': 'Arts & Culture',
    'food-drink': 'Food & Drink',
    entertainment: 'Entertainment & Shopping',
    places: 'Places / Destinations'
  };

  const subCategoryLabels: Record<string, string> = {
    // Transportation
    'flight': 'Flight',
    'train': 'Train',
    'bus': 'Bus',
    'car-rental': 'Car Rental',
    'taxi': 'Taxi',
    'bike-rental': 'Bike Rental',
    'moped': 'Moped',
    'scooter': 'Scooter',
    'ferry': 'Ferry',
    'cruise': 'Cruise',
    'campervan': 'Campervan',
    'cable-car': 'Cable Car',
    'heritage-train': 'Heritage Train',
    'walking': 'Walking',
    'road-trip': 'Road Trip',

    // Accommodation
    'hotel': 'Hotel',
    'airbnb': 'Airbnb',
    'hostel': 'Hostel',
    'guesthouse': 'Guesthouse',
    'camping': 'Camping',
    'glamping': 'Glamping',
    'eco-lodge': 'Eco Lodge',
    'castle-accommodation': 'Castle',
    'rv-site': 'RV Site',
    'cabin': 'Cabin',
    'historic-inn': 'Historic Inn',
    'capsule-hotel': 'Capsule Hotel',

    // Activities
    'point-of-interest': 'Point of Interest',
    'hike': 'Hiking',
    'beach': 'Beach',
    'mountain': 'Mountain',
    'volcano': 'Volcano',
    'national-park': 'National Park',
    'desert': 'Desert',
    'island-activity': 'Island',
    'viewpoint': 'Viewpoint',
    'climbing': 'Climbing',
    'snow': 'Snow Activities',
    'fishing': 'Fishing',
    'water-sports': 'Water Sports',
    'stadium': 'Stadium',
    'science-center': 'Science Center',
    'zoo': 'Zoo',
    'paragliding': 'Paragliding',
    'yoga': 'Yoga',
    'guided-experience': 'Guided Experience',

    // Arts & Culture
    'museum': 'Museum',
    'landmark': 'Landmark',
    'castle-culture': 'Castle',
    'religious-site': 'Religious Site',
    'gallery': 'Gallery',
    'theater': 'Theater',
    'movie-location': 'Movie Location',
    'architecture': 'Architecture',
    'cultural-center': 'Cultural Center',
    'artisan': 'Artisan',

    // Food & Drink
    'restaurant': 'Restaurant',
    'cafe': 'Cafe',
    'tea-house': 'Tea House',
    'street-food': 'Street Food',
    'food-market': 'Food Market',
    'brewery': 'Brewery',
    'winery': 'Winery',
    'distillery': 'Distillery',
    'dessert': 'Dessert',
    'specialty-shop': 'Specialty Shop',
    'fine-dining': 'Fine Dining',

    // Entertainment
    'tour': 'Tour',
    'theme-park': 'Theme Park',
    'carnival': 'Carnival',
    'shopping-mall': 'Shopping Mall',
    'boutique': 'Boutique',
    'souvenir': 'Souvenir Shop',
    'festival': 'Festival',
    'nightlife': 'Nightlife',
    'arcade': 'Arcade',
    'casino': 'Casino',
    'oddities': 'Oddities',

    // Places
    'city': 'City',
    'neighborhood': 'Neighborhood',
    'scenic-route': 'Scenic Route',
    'nature-spot': 'Nature Spot',
    'island-place': 'Island',
    'wilderness': 'Wilderness',
    'coastal-town': 'Coastal Town',
    'mountain-village': 'Mountain Village',
    'desert-oasis': 'Desert Oasis',
    'off-beaten-path': 'Off Beaten Path'
  };

  const getSubCategoriesForCategory = (category: CategoryType): SubCategoryType[CategoryType][] => {
    switch (category) {
      case 'transportation':
        return ['flight', 'train', 'bus', 'car-rental', 'taxi', 'bike-rental', 'moped', 'scooter', 'ferry', 'cruise', 'campervan', 'cable-car', 'heritage-train', 'walking', 'road-trip'];
      case 'accommodation':
        return ['hotel', 'airbnb', 'hostel', 'guesthouse', 'camping', 'glamping', 'eco-lodge', 'castle-accommodation', 'rv-site', 'cabin', 'historic-inn', 'capsule-hotel'];
      case 'activities':
        return ['point-of-interest', 'hike', 'beach', 'mountain', 'volcano', 'national-park', 'desert', 'island-activity', 'viewpoint', 'climbing', 'snow', 'fishing', 'water-sports', 'stadium', 'science-center', 'zoo', 'paragliding', 'yoga', 'guided-experience'];
      case 'arts-culture':
        return ['museum', 'landmark', 'castle-culture', 'religious-site', 'gallery', 'theater', 'movie-location', 'architecture', 'cultural-center', 'artisan'];
      case 'food-drink':
        return ['restaurant', 'cafe', 'tea-house', 'street-food', 'food-market', 'brewery', 'winery', 'distillery', 'dessert', 'specialty-shop', 'fine-dining'];
      case 'entertainment':
        return ['tour', 'theme-park', 'carnival', 'shopping-mall', 'boutique', 'souvenir', 'festival', 'nightlife', 'arcade', 'casino', 'oddities'];
      case 'places':
        return ['city', 'neighborhood', 'scenic-route', 'nature-spot', 'island-place', 'wilderness', 'coastal-town', 'mountain-village', 'desert-oasis', 'off-beaten-path'];
      default:
        return [];
    }
  };

  useEffect(() => {
    const fetchTrip = async () => {
      if (!id) {
        setError('Invalid trip ID');
        setIsLoading(false);
        return;
      }

      try {
        const data = await dreamTripService.getDreamTrip(id);
        setTrip(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch dream trip');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrip();
  }, [id]);

  useEffect(() => {
    if (trip?._id) {
      loadHistory(trip._id);
    }
  }, [trip?._id]);

  const handleDelete = async () => {
    if (!trip) return;
    try {
      await dreamTripService.deleteDreamTrip(trip._id);
      navigate('/trips/dream');
    } catch (err) {
      console.error('Error deleting dream trip:', err);
    }
  };

  const handleLeaveTrip = async () => {
    if (!trip) return;
    try {
      await dreamTripService.leaveTrip(trip._id);
      navigate('/trips/dream');
    } catch (err) {
      console.error('Error leaving dream trip:', err);
    }
  };

  const handleUpdateIdeas = async (updatedIdeas: TripIdeaType[]) => {
    if (!trip) return;
    try {
      // Update local state immediately for instant UI feedback
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: updatedIdeas
        };
      });

      // Make a single API call to update all ideas
      await dreamTripService.updateDreamTrip(trip._id, {
        ideas: updatedIdeas
      });
    } catch (err) {
      console.error('Error updating ideas:', err);
      setError(err instanceof Error ? err.message : 'Failed to update ideas');
      
      // Revert local state on error
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: trip.ideas
        };
      });
    }
  };

  const handleAddIdea = async () => {
    if (!trip || !newIdea.title.trim()) return;
    
    try {
      // Update local state immediately
      const tempIdea: TripIdeaType = {
        ...newIdea,
        _id: Date.now().toString(), // Temporary ID
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: trip.owner, // Use the trip owner as the creator
        images: newIdea.images || [] // Ensure images is always an array
      };

      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: [...prevTrip.ideas, tempIdea]
        };
      });

      // Make API call
      const addedIdea = await dreamTripService.addIdea(trip._id, newIdea);
      
      // Update with the real idea from the server
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: prevTrip.ideas.map(i => i._id === tempIdea._id ? addedIdea : i)
        };
      });

      setShowAddIdeaModal(false);
      
      // Reset form
      setNewIdea({
        title: '',
        location: { name: '', lat: 0, lng: 0 },
        sources: [],
        notes: '',
        priority: 2,
        images: [],
        position: { x: 0, y: 0 },
        category: 'places',
        subCategory: 'city'
      });
    } catch (err) {
      console.error('Error adding idea:', err);
      setError(err instanceof Error ? err.message : 'Failed to add idea');
      
      // Revert local state on error
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: prevTrip.ideas.filter(i => i._id !== Date.now().toString())
        };
      });
    }
  };

  const handleEditIdea = async (idea: TripIdeaType) => {
    if (!trip) return;
    
    try {
      // Update local state immediately
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: prevTrip.ideas.map(i => i._id === idea._id ? idea : i)
        };
      });

      // Make API call
      await dreamTripService.updateIdea(trip._id, idea._id, {
        _id: idea._id,
        title: idea.title,
        location: idea.location,
        sources: idea.sources,
        notes: idea.notes,
        priority: idea.priority,
        images: idea.images,
        position: idea.position,
        category: idea.category,
        subCategory: idea.subCategory
      });
    } catch (err) {
      console.error('Error updating idea:', err);
      setError(err instanceof Error ? err.message : 'Failed to update idea');
      
      // Revert local state on error
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: prevTrip.ideas.map(i => i._id === idea._id ? trip.ideas.find(original => original._id === idea._id) || i : i)
        };
      });
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    if (!trip) return;
    
    // Store the idea to be deleted for potential rollback
    const ideaToDelete = trip.ideas.find(i => i._id === ideaId);
    if (!ideaToDelete) return;
    
    try {
      // Update local state immediately
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: prevTrip.ideas.filter(i => i._id !== ideaId)
        };
      });

      // Make API call
      await dreamTripService.deleteIdea(trip._id, ideaId);
    } catch (err) {
      console.error('Error deleting idea:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete idea');
      
      // Revert local state on error
      setTrip(prevTrip => {
        if (!prevTrip) return null;
        return {
          ...prevTrip,
          ideas: [...prevTrip.ideas, ideaToDelete]
        };
      });
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value as CategoryType;
    const subCategories = getSubCategoriesForCategory(category);
    setNewIdea(prev => ({
      ...prev,
      category,
      subCategory: subCategories[0],
      // Set a default image URL based on the category if no image is provided
      images: prev.images.length === 0 ? [{ url: FALLBACK_IMAGES[category] || FALLBACK_IMAGES.default, caption: '' }] : prev.images
    }));
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subCategory = e.target.value as SubCategoryType[CategoryType];
    setNewIdea(prev => ({
      ...prev,
      subCategory
    }));
  };

  const isEditor = trip?.collaborators?.some(c => {
    if (!c) return false;
    return isCollaboratorObject(c) && c.user._id === user?._id && c.role === 'editor';
  }) ?? false;

  const isOwner = trip?.owner?._id === user?._id;
  const canEdit = isOwner || isEditor;

  const loadHistory = async (tripId: string) => {
    if (!user?._id) {
      console.log('Missing user ID:', { userId: user?._id });
      return;
    }

    try {
      console.log('Loading AI suggestions history for:', { tripId, userId: user._id });
      const history = await dreamTripService.getAISuggestions(tripId, user._id);
      console.log('Loaded AI suggestions history:', history);
      setSuggestionsHistory(history);
    } catch (error) {
      console.error('Error loading AI suggestions history:', error);
      setError('Failed to load AI suggestions history');
    }
  };

  const handleAISuggestionsSubmit = async (places: string[], activities: string[], customPrompt: string) => {
    if (!trip || !user) return;

    try {
      const suggestions = await generateDreamTripSuggestions({
        places,
        activities,
        customPrompt,
      });

      // Save to history
      const historyItem: Omit<AISuggestionHistory, '_id'> = {
        userId: user._id,
        tripId: trip._id,
        places,
        activities,
        suggestions,
        createdAt: new Date().toISOString(),
      };

      try {
        const savedHistory = await dreamTripService.saveAISuggestion(historyItem);
        setSuggestionsHistory(prev => [savedHistory, ...prev]);
        setAISuggestions(suggestions);
        setIsAISuggestionsModalOpen(false);
      } catch (error) {
        console.error('Error saving AI suggestion:', error);
        // Still show the suggestions even if saving fails
        setAISuggestions(suggestions);
        setIsAISuggestionsModalOpen(false);
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      setError('Failed to generate suggestions. Please try again later.');
    }
  };

  const handleSelectHistoryItem = (suggestion: AISuggestionHistory) => {
    setAISuggestions(suggestion.suggestions);
    setIsAISuggestionsModalOpen(false);
  };

  const handleDeleteHistoryItem = async (suggestionId: string) => {
    if (!trip?._id) {
      console.error('Cannot delete suggestion - missing trip ID');
      return;
    }

    try {
      await dreamTripService.deleteAISuggestion(suggestionId);
      // Update the suggestions history state locally
      setSuggestionsHistory(prev => prev.filter(suggestion => suggestion._id !== suggestionId));
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      setError('Failed to delete suggestion');
    }
  };

  const getCreatorInfo = (creatorId: string): User | undefined => {
    if (!trip) return undefined;

    // Check if it's the owner
    if (trip.owner._id === creatorId) {
      return trip.owner;
    }

    // Check collaborators
    const collaborator = trip.collaborators.find(c => {
      if (typeof c === 'string') {
        return c === creatorId;
      }
      return c.user._id === creatorId;
    });

    if (collaborator && typeof collaborator !== 'string') {
      return collaborator.user;
    }

    return undefined;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Dream Trip Not Found</h2>
          <p className="text-gray-600">The dream trip you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {trip.thumbnailUrl && (
            <div className="h-[300px] relative">
              <img
                src={trip.thumbnailUrl}
                alt={trip.title}
                className="object-cover w-full h-full"
              />
              {/* Trip Title and Info */}
              <div className="absolute top-4 left-4 z-20 space-y-2">
                <h1 className="text-3xl font-bold text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">{trip.title}</h1>
                <div className="flex flex-col space-y-1">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-600 text-white shadow-sm w-fit">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Dream Trip
                  </span>
                  <span className="text-lg text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    Target: {new Date(trip.targetDate.year, trip.targetDate.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              {/* Action Buttons */}
              <div className="absolute top-4 right-4 flex space-x-2 z-20">
                {canEdit && (
                  <>
                    <button
                      onClick={() => setIsAISuggestionsModalOpen(true)}
                      className="p-2 text-gray-900 bg-white hover:bg-gray-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 shadow-md"
                      title="Get AI Suggestions"
                    >
                      <SparklesIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setShowCollaboratorModal(true)}
                      className="p-2 text-gray-900 bg-white hover:bg-gray-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 shadow-md"
                      title="Manage Collaborators"
                    >
                      <UserGroupIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setShowEditForm(true)}
                      className="p-2 text-gray-900 bg-white hover:bg-gray-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 shadow-md"
                      title="Edit Trip"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    {isOwner ? (
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md"
                        title="Delete Trip"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowLeaveModal(true)}
                        className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md"
                        title="Leave Trip"
                      >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                      </button>
                    )}
                  </>
                )}
                {!canEdit && (
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md"
                    title="Leave Trip"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="absolute bottom-4 right-4 flex -space-x-3 z-20">
                {/* Owner Avatar */}
                {trip.owner._id !== user?._id && (
                  <div className="relative group">
                    <img
                      src={trip.owner.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(trip.owner.name)}&background=ffffff`}
                      alt={trip.owner.name}
                      className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover"
                    />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                      <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                        {trip.owner.name} • Owner
                      </div>
                    </div>
                  </div>
                )}
                {/* Collaborator Avatars */}
                {trip.collaborators
                  .filter(isCollaboratorObject)
                  .filter(collaborator => collaborator.user._id !== user?._id)
                  .map((collaborator) => (
                    <div key={collaborator.user._id} className="relative group">
                      <img
                        src={collaborator.user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(collaborator.user.name)}&background=ffffff`}
                        alt={collaborator.user.name}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-md object-cover"
                      />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                        <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                          {collaborator.user.name} • {collaborator.role}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {trip.description && (
            <div className="p-6">
              <p className="text-gray-600">{trip.description}</p>
              {trip.tags && trip.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {trip.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Idea Board */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">Ideas</h2>
            <button
              onClick={() => setShowAddIdeaModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              Add Idea
            </button>
          </div>
          <IdeaBoard
            ideas={trip.ideas}
            onUpdateIdeas={handleUpdateIdeas}
            onEditIdea={(idea) => {
              setSelectedIdea(idea);
              setShowEditIdeaModal(true);
            }}
            onDeleteIdea={(ideaId) => {
              setSelectedIdea(trip.ideas.find(i => i._id === ideaId) || null);
              setShowDeleteIdeaModal(true);
            }}
            tripId={trip._id}
          />
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <EditDreamTripForm
          trip={trip}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false);
            // Refresh trip data
            if (id) {
              dreamTripService.getDreamTrip(id).then(setTrip);
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Dream Trip</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{trip.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDelete();
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestions Modal */}
      {trip && (
        <DreamTripAISuggestionsModal
          isOpen={isAISuggestionsModalOpen}
          onClose={() => setIsAISuggestionsModalOpen(false)}
          onSubmit={handleAISuggestionsSubmit}
          history={suggestionsHistory}
          onSelectHistoryItem={handleSelectHistoryItem}
          onDeleteHistoryItem={handleDeleteHistoryItem}
          getCreatorInfo={getCreatorInfo}
        />
      )}

      {/* AI Suggestions Display */}
      {aiSuggestions && (
        <AISuggestionsDisplay
          suggestions={aiSuggestions}
          onClose={() => setAISuggestions(null)}
        />
      )}

      {/* Add Idea Modal */}
      {showAddIdeaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Add New Idea</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleAddIdea();
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={newIdea.title}
                      onChange={(e) => setNewIdea(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newIdea.category}
                      onChange={handleCategoryChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <select
                      value={newIdea.subCategory}
                      onChange={handleSubCategoryChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {getSubCategoriesForCategory(newIdea.category).map((subCategory) => (
                        <option key={subCategory} value={subCategory}>
                          {subCategoryLabels[subCategory]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={newIdea.location?.name || ''}
                      onChange={(e) => setNewIdea(prev => ({
                        ...prev,
                        location: { name: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter location name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={newIdea.notes}
                      onChange={(e) => setNewIdea(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={newIdea.priority}
                      onChange={(e) => setNewIdea(prev => ({
                        ...prev,
                        priority: Number(e.target.value) as 1 | 2 | 3
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={1}>Maybe</option>
                      <option value={2}>Interested</option>
                      <option value={3}>Must Do</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={newIdea.images[0]?.url || ''}
                      onChange={(e) => setNewIdea(prev => ({
                        ...prev,
                        images: [{ url: e.target.value || FALLBACK_IMAGES[prev.category] || FALLBACK_IMAGES.default, caption: prev.images[0]?.caption || '' }]
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter image URL or leave blank for default"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave blank to use a default image for this category
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image Caption
                    </label>
                    <input
                      type="text"
                      value={newIdea.images[0]?.caption || ''}
                      onChange={(e) => setNewIdea(prev => ({
                        ...prev,
                        images: [{ url: prev.images[0]?.url || '', caption: e.target.value }]
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddIdeaModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newIdea.title}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Idea
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Idea Modal */}
      {showEditIdeaModal && selectedIdea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Edit Idea</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleEditIdea(selectedIdea);
                setShowEditIdeaModal(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={selectedIdea.title}
                      onChange={(e) => setSelectedIdea(prev => prev ? { ...prev, title: e.target.value } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={selectedIdea.category}
                      onChange={(e) => {
                        const category = e.target.value as CategoryType;
                        const subCategories = getSubCategoriesForCategory(category);
                        setSelectedIdea(prev => prev ? {
                          ...prev,
                          category,
                          subCategory: subCategories[0]
                        } : null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <select
                      value={selectedIdea.subCategory}
                      onChange={(e) => setSelectedIdea(prev => prev ? {
                        ...prev,
                        subCategory: e.target.value as SubCategoryType[CategoryType]
                      } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {getSubCategoriesForCategory(selectedIdea.category).map((subCategory) => (
                        <option key={subCategory} value={subCategory}>
                          {subCategoryLabels[subCategory]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={selectedIdea.location?.name || ''}
                      onChange={(e) => setSelectedIdea(prev => prev ? {
                        ...prev,
                        location: { ...prev.location, name: e.target.value }
                      } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter location name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={selectedIdea.notes}
                      onChange={(e) => setSelectedIdea(prev => prev ? { ...prev, notes: e.target.value } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={selectedIdea.priority}
                      onChange={(e) => setSelectedIdea(prev => prev ? {
                        ...prev,
                        priority: Number(e.target.value) as 1 | 2 | 3
                      } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={1}>Maybe</option>
                      <option value={2}>Interested</option>
                      <option value={3}>Must Do</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={selectedIdea.images[0]?.url || ''}
                      onChange={(e) => setSelectedIdea(prev => prev ? {
                        ...prev,
                        images: [{ url: e.target.value || FALLBACK_IMAGES[prev.category] || FALLBACK_IMAGES.default, caption: prev.images[0]?.caption || '' }]
                      } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter image URL or leave blank for default"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave blank to use a default image for this category
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image Caption
                    </label>
                    <input
                      type="text"
                      value={selectedIdea.images[0]?.caption || ''}
                      onChange={(e) => setSelectedIdea(prev => prev ? {
                        ...prev,
                        images: [{ url: prev.images[0]?.url || '', caption: e.target.value }]
                      } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditIdeaModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedIdea.title.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Idea Modal */}
      {showDeleteIdeaModal && selectedIdea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Idea</h3>
              <button
                onClick={() => setShowDeleteIdeaModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this idea? This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteIdeaModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteIdea(selectedIdea._id);
                  setShowDeleteIdeaModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Trip Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Leave Dream Trip</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to leave "{trip.title}"? You will lose access to this trip.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleLeaveTrip();
                  setShowLeaveModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Leave Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collaborator Management Modal */}
      <CollaboratorManagementModal
        trip={trip}
        isOpen={showCollaboratorModal}
        onClose={() => setShowCollaboratorModal(false)}
        onUpdate={(updatedTrip) => {
          setTrip(updatedTrip);
        }}
      />
    </div>
  );
};

export default DreamTripDetails; 