import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Settlement } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import { formatCurrency } from '../../utils/format';
import { networkAwareApi } from '../../services/networkAwareApi';

import { simplifyDebts } from '../../utils/debtSimplification';
import { EXPENSE_CURRENCIES } from '../../utils/expenseOptions';

interface SettlementManagementProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

interface SettlementPreview {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export const SettlementManagement: React.FC<SettlementManagementProps> = ({
  tripId,
  participants,
  currentUser
}) => {
  const { settlements, addSettlement, updateSettlement, deleteSettlement, refreshData, expenseSummary } = useExpense();
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [hasSimplifiedDebts, setHasSimplifiedDebts] = useState(false);
  const [completionMethod, setCompletionMethod] = useState<'cash' | 'bank_transfer' | 'venmo' | 'other'>('cash');
  const [settlementToComplete, setSettlementToComplete] = useState<Settlement | null>(null);
  const [previewSettlements, setPreviewSettlements] = useState<SettlementPreview[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getParticipantName = (userId: string) => participants.find(p => p._id === userId)?.name || 'Unknown traveler';

  const resetFeedback = () => {
    setActionMessage(null);
    setActionError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (fromUserId === toUserId) {
      setActionError('Choose two different people for the settlement.');
      return;
    }

    if (!Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setActionError('Settlement amount must be greater than 0.');
      return;
    }
    
    const settlement: Omit<Settlement, '_id'> = {
      tripId,
      fromUserId: {
        _id: fromUserId,
        name: participants.find(p => p._id === fromUserId)?.name || '',
        email: participants.find(p => p._id === fromUserId)?.email || ''
      },
      toUserId: {
        _id: toUserId,
        name: participants.find(p => p._id === toUserId)?.name || '',
        email: participants.find(p => p._id === toUserId)?.email || ''
      },
      amount: parseFloat(amount),
      currency,
      status: 'pending',
      date: new Date().toISOString(),
      notes
    };

    try {
      setIsSaving(true);
      await addSettlement(tripId, settlement);
      await refreshData(tripId);
      setActionMessage('Settlement recorded.');
      // Reset form
      setFromUserId('');
      setToUserId('');
      setAmount('');
      setNotes('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to add settlement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async (settlement: Settlement) => {
    setSettlementToComplete(settlement);
  };

  const handleConfirmCompletion = async () => {
    if (!settlementToComplete) return;
    resetFeedback();

    try {
      await updateSettlement(tripId, settlementToComplete._id, { 
        status: 'completed',
        method: completionMethod
      });
      await refreshData(tripId);
      setSettlementToComplete(null);
      setCompletionMethod('cash');
      setActionMessage('Settlement marked as completed.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to mark settlement as completed.');
    }
  };

  const handleDeleteSettlement = async (settlement: Settlement) => {
    resetFeedback();

    try {
      await deleteSettlement(tripId, settlement._id);
      setActionMessage('Settlement deleted.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete settlement.');
    }
  };

  const handleSimplifyDebts = async () => {
    if (!expenseSummary) return;
    resetFeedback();

    if (expenseSummary.hasMixedCurrencies) {
      setActionError('Debt simplification is available after expenses are recorded in a single currency.');
      return;
    }

    // Convert perPersonBalances to the format expected by simplifyDebts
    const balances = Object.entries(expenseSummary.perPersonBalances).map(([userId, amount]) => ({
      userId,
      amount: amount as number
    }));

    // Get simplified settlements
    const simplifiedSettlements = simplifyDebts(balances);
    setPreviewSettlements(simplifiedSettlements);

    if (simplifiedSettlements.length === 0) {
      setActionMessage('No settlements are needed. Everyone is balanced.');
    }
  };

  const handleCreatePreviewedSettlements = async () => {
    if (!expenseSummary || previewSettlements.length === 0) return;
    resetFeedback();
    setIsSaving(true);

    try {
      for (const settlement of previewSettlements) {
      const fromUser = participants.find(p => p._id === settlement.fromUserId);
      const toUser = participants.find(p => p._id === settlement.toUserId);

      if (!fromUser || !toUser) continue;

      await addSettlement(tripId, {
        tripId,
        fromUserId: {
          _id: settlement.fromUserId,
          name: fromUser.name,
          email: fromUser.email
        },
        toUserId: {
          _id: settlement.toUserId,
          name: toUser.name,
          email: toUser.email
        },
        amount: settlement.amount,
        currency: settlementCurrency,
        status: 'pending',
        date: new Date().toISOString(),
        notes: 'Automatically generated by debt simplification'
      });
    }

    setHasSimplifiedDebts(true);
      setPreviewSettlements([]);
    await refreshData(tripId);
      setActionMessage('Simplified settlements created.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create simplified settlements.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSimplification = () => {
    setHasSimplifiedDebts(false);
    setPreviewSettlements([]);
    resetFeedback();
  };

  const pendingSettlements = settlements.filter(s => s.status === 'pending');
  const completedSettlements = settlements.filter(s => s.status === 'completed');
  const isOnline = networkAwareApi.getIsOnline();
  const settlementCurrency = expenseSummary?.currency === 'MULTI'
    ? currency
    : expenseSummary?.currency || currency;

  // Show offline message if not online
  if (!isOnline) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Settlements Not Available Offline</h3>
          <p className="text-yellow-700 mb-4">
            Settlement management requires an internet connection. Please connect to the internet to view and manage settlements.
          </p>
          <p className="text-sm text-yellow-600">
            You can still view and manage expenses while offline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionError}
        </div>
      )}

      {/* Add Settlement Form */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold">Add Settlement</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From</label>
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Select person</option>
                {participants.map(participant => (
                  <option key={participant._id} value={participant._id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">To</label>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Select person</option>
                {participants.map(participant => (
                  <option key={participant._id} value={participant._id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {EXPENSE_CURRENCIES.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            {previewSettlements.length > 0 ? (
              <button
                type="button"
                onClick={handleResetSimplification}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Discard Preview
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSimplifyDebts}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Preview Simplified Debts
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSaving ? 'Saving...' : 'Record Settlement'}
            </button>
          </div>
        </form>
      </div>

      {previewSettlements.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Review Simplified Settlements</h2>
          <p className="text-sm text-gray-600 mb-4">
            These pending settlements will be created only after you confirm.
          </p>
          <div className="space-y-3">
            {previewSettlements.map((settlement, index) => (
              <div key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`} className="rounded-lg bg-gray-50 p-4 text-sm">
                <span className="font-medium text-gray-900">{getParticipantName(settlement.fromUserId)}</span>
                <span className="text-gray-600"> pays </span>
                <span className="font-medium text-gray-900">{getParticipantName(settlement.toUserId)}</span>
                <span className="text-gray-600"> </span>
                <span className="font-semibold text-gray-900">{formatCurrency(settlement.amount, settlementCurrency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleResetSimplification}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Discard Preview
            </button>
            <button
              type="button"
              onClick={handleCreatePreviewedSettlements}
              disabled={isSaving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : `Create ${previewSettlements.length} Settlement${previewSettlements.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {/* Pending Settlements */}
      {pendingSettlements.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pending Settlements</h2>
          <div className="space-y-4">
            {pendingSettlements.map(settlement => (
              <div key={settlement._id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {settlement.fromUserId.name} pays {settlement.toUserId.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(settlement.amount, settlement.currency)}
                  </div>
                  {settlement.notes && (
                    <div className="text-sm text-gray-600 mt-1">{settlement.notes}</div>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-yellow-600">Pending</div>
                  <button
                    onClick={() => handleMarkCompleted(settlement)}
                    className="text-sm text-green-600 hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    Mark as Completed
                  </button>
                  <button
                    onClick={() => handleDeleteSettlement(settlement)}
                    className="text-sm text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {settlementToComplete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-labelledby="complete-settlement-title">
            <h3 id="complete-settlement-title" className="text-lg font-medium mb-4">Complete Settlement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <select
                  value={completionMethod}
                  onChange={(e) => setCompletionMethod(e.target.value as 'cash' | 'bank_transfer' | 'venmo' | 'other')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="venmo">Venmo</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSettlementToComplete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCompletion}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Settlements */}
      {completedSettlements.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Completed Settlements</h2>
          <div className="space-y-4">
            {completedSettlements.map(settlement => (
              <div key={settlement._id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {settlement.fromUserId.name} paid {settlement.toUserId.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(settlement.amount, settlement.currency)} • {settlement.method}
                  </div>
                  {settlement.notes && (
                    <div className="text-sm text-gray-600 mt-1">{settlement.notes}</div>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-green-600">Completed</div>
                  <button
                    onClick={() => handleDeleteSettlement(settlement)}
                    className="text-sm text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 