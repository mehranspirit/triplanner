import React from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Expense } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import { formatCurrency } from '../../utils/format';
import Avatar from '../Avatar';

// Define expense categories
const EXPENSE_CATEGORIES = {
  'Transportation': ['Flights', 'Trains', 'Buses', 'Taxis/Rideshares', 'Car Rental', 'Fuel', 'Parking'],
  'Accommodation': ['Hotels', 'Hostels', 'Airbnb', 'Camping', 'Other Lodging'],
  'Food & Drinks': ['Restaurants', 'Cafes', 'Groceries', 'Street Food', 'Bars', 'Snacks'],
  'Activities & Entertainment': ['Museums', 'Tours', 'Attractions', 'Shows', 'Sports', 'Recreation'],
  'Shopping': ['Souvenirs', 'Clothes', 'Electronics', 'Gifts', 'Other Items'],
  'Utilities & Services': ['Internet', 'Phone', 'Laundry', 'Cleaning', 'Other Services'],
  'Health & Medical': ['Medicine', 'Insurance', 'Medical Services', 'First Aid'],
  'Other': ['Tips', 'Fees', 'Emergency', 'Miscellaneous']
};

interface ExpenseListProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ tripId, participants, currentUser }) => {
  const { expenses, deleteExpense } = useExpense();

  const handleDelete = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense(tripId, expenseId);
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    }
  };

  const getMainCategory = (subCategory: string): string => {
    for (const [mainCat, subCats] of Object.entries(EXPENSE_CATEGORIES)) {
      if (subCats.includes(subCategory)) {
        return mainCat;
      }
    }
    return 'Other';
  };

  return (
    <div className="space-y-4">
      {expenses.map((expense) => (
        <div key={expense._id} className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start space-y-2 sm:space-y-0">
            <div className="w-full sm:w-auto">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{expense.title}</h3>
                {expense.category && (
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    {getMainCategory(expense.category)}
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">{expense.description}</p>
              <div className="mt-2 flex items-center space-x-2">
                <Avatar 
                  photoUrl={expense.paidBy.photoUrl || null}
                  name={expense.paidBy.name}
                  size="sm"
                  className="border border-gray-200"
                />
                <span className="text-sm text-gray-600">
                  Paid by {expense.paidBy.name}
                </span>
              </div>
            </div>
            <div className="text-right w-full sm:w-auto">
              <div className="text-lg font-semibold">
                {formatCurrency(expense.amount, expense.currency)}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(expense.date).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700">Split between:</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {expense.participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full text-sm"
                >
                  <Avatar 
                    photoUrl={participant.photoUrl || null}
                    name={participant.name}
                    size="sm"
                    className="border border-gray-200"
                  />
                  <span className="text-gray-600">{participant.name}</span>
                  <span className="text-gray-500">
                    ({formatCurrency(participant.share, expense.currency)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleDelete(expense._id)}
              className="text-red-500 hover:text-red-700 px-3 py-1 rounded-md hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}; 