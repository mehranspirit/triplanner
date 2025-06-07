# Offline Expense Management Integration Guide

This guide shows how to integrate the complete offline expense management functionality into your TripPlanner components.

## Overview

The offline expense system now supports:
- Complete expense CRUD operations (Create, Read, Update, Delete)
- Settlement management and tracking
- Debt simplification algorithms
- Expense participant settlement
- Automatic sync when back online
- Optimistic UI updates

## Using the Offline Expense Hook

### Basic Integration

Replace the existing `ExpenseContext` with the new `useOfflineExpenses` hook:

```tsx
// Before (using ExpenseContext)
import { useExpense } from '../context/ExpenseContext';

// After (using offline-aware hook)
import { useOfflineExpenses } from '../hooks/useOfflineExpenses';

function ExpenseComponent({ tripId }: { tripId: string }) {
  const {
    expenses,
    settlements,
    expenseSummary,
    loading,
    error,
    isOnline,
    hasPendingSync,
    addExpense,
    updateExpense,
    deleteExpense,
    settleExpense,
    addSettlement,
    updateSettlement,
    markSettlementCompleted,
    simplifyDebts,
    refreshData,
    forcSync
  } = useOfflineExpenses(tripId);
  
  // Your component logic here
}
```

## Complete Expense Management Examples

### 1. Adding an Expense

```tsx
const handleAddExpense = async () => {
  try {
    const expenseData = {
      title: 'Restaurant Bill',
      description: 'Dinner at local restaurant',
      amount: 120.50,
      currency: 'USD',
      date: new Date().toISOString(),
      paidBy: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        photoUrl: currentUser.photoUrl
      },
      splitMethod: 'equal' as const,
      participants: tripParticipants.map(user => ({
        userId: user._id,
        name: user.name,
        share: 120.50 / tripParticipants.length,
        splitDetails: {
          equal: { splitCount: tripParticipants.length }
        },
        settled: false,
        photoUrl: user.photoUrl
      })),
      category: 'food'
    };

    const newExpense = await addExpense(expenseData);
    console.log('Expense added:', newExpense);
    
    if (!isOnline) {
      setMessage('Expense saved offline and will sync when back online');
    }
  } catch (error) {
    console.error('Failed to add expense:', error);
    setError('Failed to add expense');
  }
};
```

### 2. Updating an Expense

```tsx
const handleUpdateExpense = async (expenseId: string, updates: Partial<Expense>) => {
  try {
    const updatedExpense = await updateExpense(expenseId, updates);
    console.log('Expense updated:', updatedExpense);
  } catch (error) {
    console.error('Failed to update expense:', error);
  }
};

// Example: Update expense amount
const handleAmountChange = (expenseId: string, newAmount: number) => {
  handleUpdateExpense(expenseId, { 
    amount: newAmount,
    // Recalculate participant shares
    participants: expense.participants.map(p => ({
      ...p,
      share: newAmount / expense.participants.length
    }))
  });
};
```

### 3. Settling Individual Expenses

```tsx
const handleSettleExpense = async (expenseId: string, participantId: string) => {
  try {
    await settleExpense(expenseId, participantId);
    console.log('Expense settled for participant');
  } catch (error) {
    console.error('Failed to settle expense:', error);
  }
};
```

### 4. Settlement Management

```tsx
const handleAddSettlement = async () => {
  try {
    const settlementData = {
      tripId,
      fromUserId: {
        _id: fromUser._id,
        name: fromUser.name,
        email: fromUser.email
      },
      toUserId: {
        _id: toUser._id,
        name: toUser.name,
        email: toUser.email
      },
      amount: 50.00,
      currency: 'USD',
      status: 'pending' as const,
      date: new Date().toISOString(),
      notes: 'Payment for shared expenses'
    };

    const newSettlement = await addSettlement(settlementData);
    console.log('Settlement created:', newSettlement);
  } catch (error) {
    console.error('Failed to add settlement:', error);
  }
};

const handleMarkSettlementCompleted = async (settlementId: string) => {
  try {
    const completedSettlement = await markSettlementCompleted(
      settlementId, 
      'cash' // or 'bank_transfer', 'venmo', 'other'
    );
    console.log('Settlement marked as completed:', completedSettlement);
  } catch (error) {
    console.error('Failed to complete settlement:', error);
  }
};
```

### 5. Debt Simplification

```tsx
const handleSimplifyDebts = async () => {
  if (!expenseSummary) {
    setError('No expense data available for debt simplification');
    return;
  }

  try {
    const simplifiedSettlements = await simplifyDebts(tripParticipants);
    console.log('Created simplified settlements:', simplifiedSettlements);
    
    setMessage(`Created ${simplifiedSettlements.length} optimized settlements`);
  } catch (error) {
    console.error('Failed to simplify debts:', error);
    setError('Failed to simplify debts');
  }
};
```

## Enhanced Component Example

```tsx
import React, { useState } from 'react';
import { useOfflineExpenses } from '../hooks/useOfflineExpenses';
import { OfflineIndicator } from '../components/OfflineIndicator';

interface ExpenseManagerProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  tripId,
  participants,
  currentUser
}) => {
  const {
    expenses,
    settlements,
    expenseSummary,
    loading,
    error,
    isOnline,
    hasPendingSync,
    addExpense,
    updateExpense,
    deleteExpense,
    settleExpense,
    addSettlement,
    updateSettlement,
    markSettlementCompleted,
    simplifyDebts,
    refreshData,
    forcSync
  } = useOfflineExpenses(tripId);

  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  // Show offline capabilities message
  React.useEffect(() => {
    if (!isOnline) {
      setShowOfflineMessage(true);
      const timer = setTimeout(() => setShowOfflineMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (loading) {
    return <div className="flex justify-center p-4">Loading expenses...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Offline Status Indicator */}
      <OfflineIndicator />
      
      {/* Offline Message */}
      {showOfflineMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            You're working offline. All changes will sync automatically when you reconnect.
            All expense features are available including settlements and debt simplification.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Pending Sync Indicator */}
      {hasPendingSync && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex justify-between items-center">
          <p className="text-sm text-yellow-800">
            You have unsaved changes that will sync when back online.
          </p>
          {isOnline && (
            <button
              onClick={forcSync}
              className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
            >
              Sync Now
            </button>
          )}
        </div>
      )}

      {/* Expense Summary */}
      {expenseSummary && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Expense Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-xl font-bold">
                {expenseSummary.currency} {expenseSummary.totalAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Unsettled Amount</p>
              <p className="text-xl font-bold text-red-600">
                {expenseSummary.currency} {expenseSummary.unsettledAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <button
                onClick={handleSimplifyDebts}
                disabled={expenseSummary.unsettledAmount === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Simplify Debts
              </button>
            </div>
          </div>

          {/* Balance Details */}
          <div className="mt-4">
            <h4 className="font-medium mb-2">Individual Balances</h4>
            <div className="space-y-1">
              {Object.entries(expenseSummary.perPersonBalances).map(([userId, balance]) => {
                const user = participants.find(p => p._id === userId);
                if (!user) return null;
                
                return (
                  <div key={userId} className="flex justify-between text-sm">
                    <span>{user.name}</span>
                    <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {balance >= 0 ? 'Owed' : 'Owes'} {expenseSummary.currency} {Math.abs(balance).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Expenses</h3>
            <button
              onClick={() => {/* Open add expense modal */}}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Add Expense
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {expenses.map(expense => (
            <ExpenseCard
              key={expense._id}
              expense={expense}
              participants={participants}
              onUpdate={(updates) => updateExpense(expense._id, updates)}
              onDelete={() => deleteExpense(expense._id)}
              onSettleParticipant={(participantId) => settleExpense(expense._id, participantId)}
              isOffline={!isOnline}
            />
          ))}
          
          {expenses.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No expenses yet. Add your first expense to get started.
            </div>
          )}
        </div>
      </div>

      {/* Settlements List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Settlements</h3>
            <button
              onClick={() => {/* Open add settlement modal */}}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Settlement
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {settlements.map(settlement => (
            <SettlementCard
              key={settlement._id}
              settlement={settlement}
              onUpdate={(updates) => updateSettlement(settlement._id, updates)}
              onMarkCompleted={(method) => markSettlementCompleted(settlement._id, method)}
              isOffline={!isOnline}
            />
          ))}
          
          {settlements.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No settlements yet. Add settlements or use debt simplification.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

## Testing Offline Functionality

### 1. Test Expense Operations Offline

1. Turn off your network connection
2. Add a new expense - should work immediately
3. Edit an existing expense - changes should be visible
4. Delete an expense - should be removed from the list
5. Settle expense participants - status should update
6. Check the offline indicator for pending operations

### 2. Test Settlement Operations Offline

1. While offline, add a new settlement
2. Update settlement status or method
3. Mark settlements as completed
4. Use debt simplification feature
5. Verify all changes are queued for sync

### 3. Test Sync When Back Online

1. Reconnect to the network
2. Changes should automatically sync
3. Force sync using the offline indicator if needed
4. Verify all data matches the server state

## Performance Considerations

- The system caches all expense and settlement data locally
- Optimistic updates provide immediate UI feedback
- Network requests are debounced to prevent duplicate operations
- Storage usage is monitored and displayed in the offline indicator

## Error Handling

- Network failures are gracefully handled with fallback to cache
- Sync failures are retried automatically (up to 3 times)
- User-friendly error messages are shown for failed operations
- Offline capabilities are clearly communicated to users

This comprehensive offline expense management system ensures users can fully manage trip expenses regardless of network connectivity, with automatic synchronization when back online. 