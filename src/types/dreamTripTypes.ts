import { User } from './index';

export type CategoryType = 
  | 'transportation'
  | 'accommodation'
  | 'activities'
  | 'arts-culture'
  | 'food-drink'
  | 'entertainment'
  | 'places';

export type SubCategoryType = {
  transportation: 
    | 'flight' | 'train' | 'bus' | 'car-rental' | 'taxi' | 'bike-rental' 
    | 'moped' | 'scooter' | 'ferry' | 'cruise' | 'campervan' | 'cable-car'
    | 'heritage-train' | 'walking' | 'road-trip';
  accommodation:
    | 'hotel' | 'airbnb' | 'hostel' | 'guesthouse' | 'camping' | 'glamping'
    | 'eco-lodge' | 'castle-accommodation' | 'rv-site' | 'cabin' | 'historic-inn' | 'capsule-hotel';
  activities:
    | 'point-of-interest' | 'hike' | 'beach' | 'mountain' | 'volcano' | 'national-park'
    | 'desert' | 'island-activity' | 'viewpoint' | 'climbing' | 'snow' | 'fishing'
    | 'water-sports' | 'stadium' | 'science-center' | 'zoo' | 'paragliding' | 'yoga'
    | 'guided-experience';
  'arts-culture':
    | 'museum' | 'landmark' | 'castle-culture' | 'religious-site' | 'gallery' | 'theater'
    | 'movie-location' | 'architecture' | 'cultural-center' | 'artisan';
  'food-drink':
    | 'restaurant' | 'cafe' | 'tea-house' | 'street-food' | 'food-market' | 'brewery'
    | 'winery' | 'distillery' | 'dessert' | 'specialty-shop' | 'fine-dining';
  entertainment:
    | 'tour' | 'theme-park' | 'carnival' | 'shopping-mall' | 'boutique' | 'souvenir'
    | 'festival' | 'nightlife' | 'arcade' | 'casino' | 'oddities';
  places:
    | 'city' | 'neighborhood' | 'scenic-route' | 'nature-spot' | 'island-place' | 'wilderness'
    | 'coastal-town' | 'mountain-village' | 'desert-oasis' | 'off-beaten-path';
};

export interface TripIdea {
  _id: string;
  title: string;
  location?: {
    name: string;
    lat?: number;
    lng?: number;
  };
  sources: string[];
  notes: string;
  priority: 1 | 2 | 3; // 1 = maybe, 2 = interested, 3 = must do
  images: {
    url: string;
    caption?: string;
  }[];
  position: {
    x: number;
    y: number;
  };
  category: CategoryType;
  subCategory: SubCategoryType[CategoryType];
  createdAt: string;
  updatedAt: string;
  createdBy: User;
}

export interface DreamTrip {
  _id: string;
  title: string;
  description?: string;
  targetDate: {
    year: number;
    month: number;
  };
  ideas: TripIdea[];
  owner: User;
  collaborators: (string | { user: User; role: 'viewer' | 'editor' })[];
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  tags: string[];
  location?: {
    lat: number;
    lng: number;
    name: string;
  };
  notes?: string;
  settings?: {
    defaultCurrency: string;
    timezone: string;
    notifications: boolean;
    sharing: {
      public: boolean;
      collaborators: string[];
    };
  };
  shareableLink?: string;
}

export interface CreateDreamTripData {
  title: string;
  description: string;
  targetDate: {
    year: number;
    month: number;
  };
  tags: string[];
  thumbnailUrl?: string;
  collaborators?: string[];
  ideas?: TripIdea[];
}

export interface CreateTripIdeaData {
  title: string;
  location?: {
    name: string;
    lat?: number;
    lng?: number;
  };
  sources: string[];
  notes: string;
  priority: 1 | 2 | 3;
  images: {
    url: string;
    caption?: string;
  }[];
  position: {
    x: number;
    y: number;
  };
  category: CategoryType;
  subCategory: SubCategoryType[CategoryType];
}

export interface UpdateTripIdeaData extends Partial<CreateTripIdeaData> {
  _id: string;
} 