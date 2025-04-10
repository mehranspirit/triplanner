import React, { useState } from 'react';
import { TripIdea as TripIdeaType, CategoryType } from '../types/dreamTripTypes';

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

interface TripIdeaProps {
  idea: TripIdeaType;
  onEdit: (idea: TripIdeaType) => void;
  onDelete: (ideaId: string) => void;
  onPriorityChange: (ideaId: string, priority: 1 | 2 | 3) => void;
}

const categoryIcons: Record<CategoryType, string> = {
  transportation: '🧭',
  accommodation: '🛌',
  activities: '🎯',
  'arts-culture': '🖼️',
  'food-drink': '🍴',
  entertainment: '🎉',
  places: '🗺️'
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

const subCategoryIcons: Record<string, string> = {
  // Transportation
  'flight': '✈️',
  'train': '🚂',
  'bus': '🚌',
  'car-rental': '🚗',
  'taxi': '🚕',
  'bike-rental': '🚲',
  'moped': '🛵',
  'scooter': '🛵',
  'ferry': '⛴️',
  'cruise': '🚢',
  'campervan': '🚐',
  'cable-car': '🚡',
  'heritage-train': '🚂',
  'walking': '🚶',
  'road-trip': '🚗',

  // Accommodation
  'hotel': '🏨',
  'airbnb': '🏠',
  'hostel': '🏘️',
  'guesthouse': '🏡',
  'camping': '⛺',
  'glamping': '🏕️',
  'eco-lodge': '🌿',
  'castle-accommodation': '🏰',
  'rv-site': '🚐',
  'cabin': '🏚️',
  'historic-inn': '🏛️',
  'capsule-hotel': '🏢',

  // Activities
  'point-of-interest': '📍',
  'hike': '🥾',
  'beach': '🏖️',
  'mountain': '⛰️',
  'volcano': '🌋',
  'national-park': '🏞️',
  'desert': '🏜️',
  'island-activity': '🏝️',
  'viewpoint': '👀',
  'climbing': '🧗',
  'snow': '❄️',
  'fishing': '🎣',
  'water-sports': '🏊',
  'stadium': '🏟️',
  'science-center': '🔬',
  'zoo': '🦁',
  'paragliding': '🪂',
  'yoga': '🧘',
  'guided-experience': '👥',

  // Arts & Culture
  'museum': '🏛️',
  'landmark': '🗽',
  'castle-culture': '🏰',
  'religious-site': '⛩️',
  'gallery': '🖼️',
  'theater': '🎭',
  'movie-location': '🎬',
  'architecture': '🏛️',
  'cultural-center': '🏛️',
  'artisan': '🎨',

  // Food & Drink
  'restaurant': '🍽️',
  'cafe': '☕',
  'tea-house': '🍵',
  'street-food': '🍜',
  'food-market': '🥬',
  'brewery': '🍺',
  'winery': '🍷',
  'distillery': '🥃',
  'dessert': '🍰',
  'specialty-shop': '🛍️',
  'fine-dining': '🍽️',

  // Entertainment
  'tour': '🚶',
  'theme-park': '🎢',
  'carnival': '🎪',
  'shopping-mall': '🏪',
  'boutique': '👕',
  'souvenir': '🎁',
  'festival': '🎉',
  'nightlife': '🌙',
  'arcade': '🎮',
  'casino': '🎰',
  'oddities': '🎪',

  // Places
  'city': '🏙️',
  'neighborhood': '🏘️',
  'scenic-route': '🛣️',
  'nature-spot': '🌿',
  'island-place': '🏝️',
  'wilderness': '🌲',
  'coastal-town': '🌊',
  'mountain-village': '🏔️',
  'desert-oasis': '🏜️',
  'off-beaten-path': '🗺️'
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

export const TripIdea: React.FC<TripIdeaProps> = ({
  idea,
  onEdit,
  onDelete,
  onPriorityChange
}) => {
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const priorityColors = {
    1: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    2: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    3: 'bg-green-100 text-green-800 hover:bg-green-200'
  };

  const priorityLabels = {
    1: 'Maybe',
    2: 'Interested',
    3: 'Must Do'
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPriority = Number(e.target.value) as 1 | 2 | 3;
    onPriorityChange(idea._id, newPriority);
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  };

  const firstLineOfNotes = idea.notes.split('\n')[0];
  const hasMoreLines = idea.notes.split('\n').length > 1;

  const convertUrlsToLinks = (text: string) => {
    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlPattern);
    
    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        const displayUrl = part.length > 50 ? part.substring(0, 47) + '...' : part;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
            className="text-blue-600 hover:text-blue-800 hover:underline"
            title={part}
          >
            {displayUrl}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 transition-shadow duration-200 hover:shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-900 truncate">{idea.title}</h3>
        <select
          value={idea.priority}
          onChange={handlePriorityChange}
          className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${priorityColors[idea.priority]}`}
        >
          <option value={1}>Maybe</option>
          <option value={2}>Interested</option>
          <option value={3}>Must Do</option>
        </select>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {categoryIcons[idea.category]} {categoryLabels[idea.category]}
        </span>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          {subCategoryIcons[idea.subCategory]} {subCategoryLabels[idea.subCategory]}
        </span>
      </div>

      {idea.images && idea.images.length > 0 && idea.images[0].url && (
        <div className="relative mb-3">
          <img
            src={idea.images[0].url}
            alt={idea.images[0].caption || idea.title}
            className="w-full h-48 object-cover rounded-lg"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              // Use category-specific fallback or default
              const fallbackUrl = FALLBACK_IMAGES[idea.category] || FALLBACK_IMAGES.default;
              target.src = fallbackUrl;
            }}
          />
          {idea.images[0].caption && (
            <p className="mt-1 text-sm text-gray-600 truncate">{idea.images[0].caption}</p>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => onEdit(idea)}
              className="p-1 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow-md transition-colors"
              title="Edit idea"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(idea._id)}
              className="p-1 bg-white/90 hover:bg-white rounded-full text-red-600 shadow-md transition-colors"
              title="Delete idea"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {idea.notes && (
        <div className="text-sm text-gray-600">
          <div className="whitespace-pre-line break-words">
            {isNotesExpanded ? convertUrlsToLinks(idea.notes) : convertUrlsToLinks(firstLineOfNotes)}
          </div>
          {hasMoreLines && (
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="text-purple-600 hover:text-purple-800 text-xs mt-1"
            >
              {isNotesExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {idea.sources && idea.sources.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="text-gray-500 mb-1">Sources:</p>
          <ul className="space-y-1">
            {idea.sources.map((source, index) => (
              <li key={index} className="break-all">
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {source}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}; 