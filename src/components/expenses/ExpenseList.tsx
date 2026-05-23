import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Expense, ExpenseParticipant } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import { formatCurrency } from '../../utils/format';
import { EXPENSE_EMOJIS } from '../../utils/expenseEmojis';
import { cn } from '@/lib/utils';
import { EditExpense } from './EditExpense';

interface ExpenseListProps {
  tripId: string;
  participants: User[];
  currentUser: User;
  onAddExpense?: () => void;
}

type ExpenseFilter = 'all' | 'paidByMe' | 'iOwe' | 'unsettled';

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

export const ExpenseList: React.FC<ExpenseListProps> = ({ tripId, participants, currentUser, onAddExpense }) => {
  const { expenses, deleteExpense, refreshData, loading, error } = useExpense();
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  const [deletingExpenses, setDeletingExpenses] = useState<Set<string>>(new Set());
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ExpenseFilter>('all');
  const editDialogRef = React.useRef<HTMLDivElement>(null);
  const editTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!editingExpense) return;

    const dialog = editDialogRef.current;
    const focusableElements = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditingExpense(null);
        return;
      }

      if (event.key !== 'Tab' || !focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      editTriggerRef.current?.focus();
    };
  }, [editingExpense]);

  // Filter out temporary expenses that have corresponding real expenses
  const filteredExpenses = React.useMemo(() => {
    const realExpenses = expenses.filter(e => !e._id.startsWith('temp-'));
    const tempExpenses = expenses.filter(e => e._id.startsWith('temp-'));
    
    // Remove temp expenses that have a corresponding real expense with same title and amount
    const validTempExpenses = tempExpenses.filter(tempExpense => {
      return !realExpenses.some(realExpense => 
        realExpense.title === tempExpense.title && 
        realExpense.amount === tempExpense.amount &&
        Math.abs(new Date(realExpense.createdAt).getTime() - new Date(tempExpense.createdAt).getTime()) < 60000 // Within 1 minute
      );
    });
    
    return [...realExpenses, ...validTempExpenses].sort((a, b) => (
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
  }, [expenses]);

  const getCurrentUserParticipant = (expense: Expense) => (
    expense.participants.find(participant => participant.userId === currentUser._id)
  );

  const getPersonalImpact = (expense: Expense) => {
    const paidByMe = expense.paidBy._id === currentUser._id;
    const userParticipant = getCurrentUserParticipant(expense);

    if (paidByMe) {
      const owedByOthers = expense.participants
        .filter(participant => participant.userId !== currentUser._id && !participant.settled)
        .reduce((sum, participant) => sum + participant.share, 0);
      return owedByOthers > 0
        ? `You paid. Others owe ${formatCurrency(owedByOthers, expense.currency)}`
        : `You paid ${formatCurrency(expense.amount, expense.currency)}`;
    }

    if (userParticipant) {
      return userParticipant.settled
        ? `Your share is settled`
        : `Your share: ${formatCurrency(userParticipant.share, expense.currency)}`;
    }

    return 'Not split with you';
  };

  const visibleExpenses = filteredExpenses.filter(expense => {
    if (activeFilter === 'paidByMe') return expense.paidBy._id === currentUser._id;
    if (activeFilter === 'iOwe') {
      const userParticipant = getCurrentUserParticipant(expense);
      return expense.paidBy._id !== currentUser._id && Boolean(userParticipant && !userParticipant.settled);
    }
    if (activeFilter === 'unsettled') {
      return expense.participants.some(participant => !participant.settled);
    }
    return true;
  });

  const handleDelete = async (expenseId: string) => {
    try {
      setActionError(null);
      setDeletingExpenses(prev => new Set(prev).add(expenseId));
      await new Promise(resolve => setTimeout(resolve, 300));
      await deleteExpense(tripId, expenseId);
      setDeleteConfirmId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete expense. Please try again.');
      setDeletingExpenses(prev => {
        const newSet = new Set(prev);
        newSet.delete(expenseId);
        return newSet;
      });
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingExpense(null);
            }
          }}
        >
          <div
            ref={editDialogRef}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-expense-title"
            aria-describedby="edit-expense-description"
            tabIndex={-1}
          >
            <p id="edit-expense-description" className="sr-only">
              Update the expense details, split, payer, participants, and category.
            </p>
            <div className="p-6">
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

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          Loading expenses...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Unable to load expenses.</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => refreshData(tripId)}
            className="mt-3 text-sm font-medium text-red-800 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredExpenses.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <h3 className="text-base font-semibold text-gray-900">No expenses yet</h3>
          <p className="mt-2 text-sm text-gray-600">
            Add your first trip expense to start tracking shared costs and balances.
          </p>
          {onAddExpense && (
            <button
              type="button"
              onClick={onAddExpense}
              className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Add first expense
            </button>
          )}
        </div>
      )}

      {!loading && !error && filteredExpenses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['paidByMe', 'Paid by me'],
            ['iOwe', 'I owe'],
            ['unsettled', 'Unsettled']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveFilter(id as ExpenseFilter)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                activeFilter === id
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionError}
        </div>
      )}

      {!loading && !error && filteredExpenses.length > 0 && visibleExpenses.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
          <h3 className="text-base font-semibold text-gray-900">No expenses match this filter</h3>
          <p className="mt-2 text-sm text-gray-600">Try a different filter or add a new expense.</p>
        </div>
      )}

      {visibleExpenses.map((expense) => (
        <div
          key={expense._id}
          className={cn(
            "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300",
            deletingExpenses.has(expense._id) && "opacity-0 transform -translate-x-4"
          )}
        >
          <div
            role="button"
            tabIndex={0}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            onClick={() => toggleExpense(expense._id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleExpense(expense._id);
              }
            }}
            aria-expanded={expandedExpenses.has(expense._id)}
            aria-controls={`expense-details-${expense._id}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  {expense.category && (
                    <p className="mt-1 text-xs text-gray-500">{expense.category}</p>
                  )}
                  <p className="mt-1 text-xs font-medium text-blue-700">{getPersonalImpact(expense)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(expense.amount, expense.currency)}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      editTriggerRef.current = e.currentTarget;
                      setEditingExpense(expense);
                    }}
                    className="rounded text-gray-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`Edit ${expense.title}`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(expense._id);
                  }}
                  className="rounded text-gray-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Delete ${expense.title}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                </div>
              </div>
            </div>
          </div>

          {deleteConfirmId === expense._id && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-800">Delete “{expense.title}”? This cannot be undone.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(expense._id)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {expandedExpenses.has(expense._id) && (
            <div id={`expense-details-${expense._id}`} className="px-4 pb-4 border-t border-gray-100">
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