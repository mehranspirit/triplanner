// Define comprehensive keyword mappings for expense categories
export const EXPENSE_KEYWORDS = {
  'Transportation': {
    'Flights': ['flight', 'plane', 'air', 'airline', 'airways', 'boarding', 'airport'],
    'Trains': ['train', 'rail', 'railway', 'subway', 'metro', 'rail pass'],
    'Buses': ['bus', 'coach', 'shuttle', 'transit', 'transit pass'],
    'Taxis/Rideshares': ['taxi', 'uber', 'lyft', 'cab', 'ride', 'grab', 'ride share'],
    'Car Rental': ['rental car', 'hertz', 'avis', 'enterprise', 'car hire', 'rental'],
    'Fuel': ['gas', 'fuel', 'petrol', 'diesel', 'gasoline', 'filling station'],
    'Parking': ['parking', 'garage', 'lot', 'parking fee', 'parking ticket']
  },
  'Accommodation': {
    'Hotels': ['hotel', 'inn', 'resort', 'hilton', 'marriott', 'hyatt', 'lodging'],
    'Hostels': ['hostel', 'backpacker', 'dormitory', 'shared room'],
    'Airbnb': ['airbnb', 'vrbo', 'vacation rental', 'home rental'],
    'Camping': ['camp', 'campsite', 'tent', 'rv', 'campground'],
    'Other Lodging': ['lodge', 'motel', 'accommodation', 'guesthouse']
  },
  'Food & Drinks': {
    'Restaurants': ['restaurant', 'dining', 'dinner', 'lunch', 'bistro', 'cafe', 'eatery'],
    'Cafes': ['coffee', 'cafe', 'starbucks', 'espresso', 'bakery'],
    'Groceries': ['grocery', 'supermarket', 'market', 'food store', 'produce'],
    'Street Food': ['street food', 'food truck', 'vendor', 'stall', 'hawker'],
    'Bars': ['bar', 'pub', 'beer', 'drinks', 'cocktail', 'wine'],
    'Snacks': ['snack', 'candy', 'chips', 'dessert', 'ice cream']
  },
  'Activities & Entertainment': {
    'Museums': ['museum', 'gallery', 'exhibition', 'art gallery', 'exhibit'],
    'Tours': ['tour', 'guide', 'sightseeing', 'excursion', 'guided tour'],
    'Attractions': ['park', 'attraction', 'admission', 'ticket', 'entry', 'amusement'],
    'Shows': ['show', 'concert', 'theater', 'cinema', 'movie', 'performance'],
    'Sports': ['sport', 'game', 'match', 'fitness', 'gym', 'sports equipment'],
    'Recreation': ['recreation', 'activity', 'adventure', 'hiking', 'biking']
  },
  'Shopping': {
    'Souvenirs': ['souvenir', 'gift', 'memento', 'keepsake', 'trinket'],
    'Clothes': ['clothes', 'clothing', 'shirt', 'pants', 'dress', 'shoes'],
    'Electronics': ['electronics', 'phone', 'camera', 'computer', 'gadget'],
    'Gifts': ['gift', 'present', 'donation', 'charity'],
    'Other Items': ['shop', 'store', 'purchase', 'merchandise']
  },
  'Utilities & Services': {
    'Internet': ['internet', 'wifi', 'data', 'mobile data', 'sim card'],
    'Phone': ['phone', 'mobile', 'cellular', 'calling card'],
    'Laundry': ['laundry', 'washing', 'dry cleaning', 'laundromat'],
    'Cleaning': ['cleaning', 'housekeeping', 'maid', 'janitor'],
    'Other Services': ['service', 'repair', 'maintenance', 'utility']
  },
  'Health & Medical': {
    'Medicine': ['medicine', 'pharmacy', 'drugstore', 'prescription'],
    'Insurance': ['insurance', 'coverage', 'health insurance'],
    'Medical Services': ['doctor', 'hospital', 'clinic', 'medical'],
    'First Aid': ['first aid', 'bandage', 'medicine kit']
  },
  'Other': {
    'Tips': ['tip', 'gratuity', 'service charge'],
    'Fees': ['fee', 'charge', 'tax', 'duty', 'surcharge'],
    'Emergency': ['emergency', 'urgent', 'ambulance'],
    'Miscellaneous': ['misc', 'other', 'various']
  }
};

export interface CategorySuggestion {
  mainCategory: string;
  subCategory: string;
  confidence: number;
}

// Helper function to calculate string similarity
const calculateSimilarity = (str1: string, str2: string): number => {
  // Convert to lowercase for case-insensitive matching
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Check for exact match
  if (s1 === s2) return 1;

  // Check if one string contains the other
  if (s2.includes(s1) || s1.includes(s2)) return 0.8;

  // Check for word matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  if (commonWords.length > 0) {
    return 0.6 * (commonWords.length / Math.max(words1.length, words2.length));
  }

  return 0;
};

export const suggestCategory = (title: string, description?: string): CategorySuggestion | null => {
  const searchText = `${title} ${description || ''}`.toLowerCase();
  let bestMatch: CategorySuggestion | null = null;
  
  // Search through all categories and keywords
  for (const [mainCategory, subCategories] of Object.entries(EXPENSE_KEYWORDS)) {
    for (const [subCategory, keywords] of Object.entries(subCategories)) {
      for (const keyword of keywords) {
        const similarity = calculateSimilarity(keyword, searchText);
        
        if (similarity > 0 && (!bestMatch || similarity > bestMatch.confidence)) {
          bestMatch = {
            mainCategory,
            subCategory,
            confidence: similarity
          };
        }
      }
    }
  }

  // Only return suggestions with confidence above threshold
  return bestMatch && bestMatch.confidence >= 0.4 ? bestMatch : null;
};

export const getMainCategory = (subCategory: string): string => {
  for (const [mainCat, subCategories] of Object.entries(EXPENSE_KEYWORDS)) {
    if (Object.keys(subCategories).includes(subCategory)) {
      return mainCat;
    }
  }
  return 'Other';
}; 