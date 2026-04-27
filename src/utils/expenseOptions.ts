export const EXPENSE_CATEGORIES: Record<string, string[]> = {
  Transportation: ['Flights', 'Trains', 'Buses', 'Taxis/Rideshares', 'Car Rental', 'Fuel', 'Parking'],
  Accommodation: ['Hotels', 'Hostels', 'Airbnb', 'Camping', 'Other Lodging'],
  'Food & Drinks': ['Restaurants', 'Cafes', 'Groceries', 'Street Food', 'Bars', 'Snacks'],
  'Activities & Entertainment': ['Museums', 'Tours', 'Attractions', 'Shows', 'Sports', 'Recreation'],
  Shopping: ['Souvenirs', 'Clothes', 'Electronics', 'Gifts', 'Other Items'],
  'Utilities & Services': ['Internet', 'Phone', 'Laundry', 'Cleaning', 'Other Services'],
  'Health & Medical': ['Medicine', 'Insurance', 'Medical Services', 'First Aid'],
  Other: ['Tips', 'Fees', 'Emergency', 'Miscellaneous']
};

export const EXPENSE_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'];

export const getMainExpenseCategory = (category?: string): string => {
  if (!category) return 'Other';

  if (EXPENSE_CATEGORIES[category]) {
    return category;
  }

  for (const [mainCategory, subcategories] of Object.entries(EXPENSE_CATEGORIES)) {
    if (subcategories.includes(category)) {
      return mainCategory;
    }
  }

  return 'Other';
};
