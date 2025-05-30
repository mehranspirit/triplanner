import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Expense, ExpenseParticipant } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import { formatCurrency } from '../../utils/format';
import Avatar from '../Avatar';
import { EXPENSE_EMOJIS } from '../../utils/expenseEmojis';
import { getMainCategory } from '../../utils/categorySuggestions';
import { cn } from '@/lib/utils';
import { EditExpense } from './EditExpense';

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

const renderSplitDetails = (participant: ExpenseParticipant, expense: Expense) => {
  const { splitDetails } = participant;
  
  if (expense.splitMethod === 'equal') {
    return `Equal split (1/${splitDetails.equal?.splitCount})`;
  } else if (expense.splitMethod === 'percentage') {
    return `${splitDetails.percentage?.value.toFixed(2)}%`;
  } else if (expense.splitMethod === 'shares') {
    return `${splitDetails.shares?.value} out of ${splitDetails.shares?.totalShares} shares`;
  } else {
    return `Custom amount: ${formatCurrency(splitDetails.custom?.amount || 0, expense.currency)}`;
  }
};

export const ExpenseList: React.FC<ExpenseListProps> = ({ tripId, participants, currentUser }) => {
  const { expenses, deleteExpense, refreshData } = useExpense();
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  const [deletingExpenses, setDeletingExpenses] = useState<Set<string>>(new Set());
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Add debug logging
  console.log('ExpenseList props:', {
    tripId,
    participants,
    currentUser,
    expenses
  });

  const handleDelete = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        // Add to deleting set
        setDeletingExpenses(prev => new Set(prev).add(expenseId));
        
        // Wait for animation to complete (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await deleteExpense(tripId, expenseId);
        console.log('Expense deleted successfully');
      } catch (error) {
        console.error('Failed to delete expense:', error);
        alert('Failed to delete expense. Please try again.');
        // Remove from deleting set if there was an error
        setDeletingExpenses(prev => {
          const newSet = new Set(prev);
          newSet.delete(expenseId);
          return newSet;
        });
      }
    }
  };

  const toggleExpense = (expenseId: string) => {
    setExpandedExpenses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId);
      } else {
        newSet.add(expenseId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Debug logging before rendering EditExpense */}
              {(() => {
                console.log('Rendering EditExpense with:', {
                  expense: editingExpense,
                  participants,
                  currentUser
                });
                return null;
              })()}
              <EditExpense
                tripId={tripId}
                expense={editingExpense}
                participants={participants}
                currentUser={currentUser}
                onExpenseUpdated={() => {
                  setEditingExpense(null);
                  refreshData(tripId);
                }}
                onCancel={() => setEditingExpense(null)}
              />
            </div>
          </div>
        </div>
      )}

      {expenses.map((expense) => (
        <div
          key={expense._id}
          className={cn(
            "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300",
            deletingExpenses.has(expense._id) && "opacity-0 transform -translate-x-4"
          )}
        >
          <div
            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleExpense(expense._id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <span className="text-xl">
                    {expense.category ? EXPENSE_EMOJIS[expense.category] : '💰'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{expense.title}</h3>
                  <p className="text-xs text-gray-500">
                    Paid by {expense.paidBy.name} • {new Date(expense.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(expense.amount, expense.currency)}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingExpense(expense);
                    }}
                    className="text-gray-400 hover:text-blue-500"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(expense._id);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {expandedExpenses.has(expense._id) && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="mt-4 space-y-4">
                {expense.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Description</h4>
                    <p className="mt-1 text-sm text-gray-900">{expense.description}</p>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Split Details</h4>
                  <div className="mt-2 space-y-2">
                    {expense.participants.map((participant) => (
                      <div key={participant.userId} className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900">{participant.name}</span>
                          <span className="text-xs text-gray-500">
                            {renderSplitDetails(participant, expense)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatCurrency(participant.share, expense.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}; 