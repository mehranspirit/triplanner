import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Settlement } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import { formatCurrency } from '../../utils/format';

interface SettlementManagementProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

export const SettlementManagement: React.FC<SettlementManagementProps> = ({
  tripId,
  participants,
  currentUser
}) => {
  const { settlements, addSettlement, updateSettlement, refreshData } = useExpense();
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const settlement: Omit<Settlement, '_id'> = {
      tripId,
      fromUserId,
      toUserId,
      amount: parseFloat(amount),
      currency,
      method,
      status: 'pending',
      date: new Date().toISOString(),
      notes
    };

    try {
      await addSettlement(tripId, settlement);
      await refreshData(tripId);
      // Reset form
      setFromUserId('');
      setToUserId('');
      setAmount('');
      setMethod('cash');
      setNotes('');
    } catch (error) {
      console.error('Failed to add settlement:', error);
    }
  };

  const handleMarkCompleted = async (settlement: Settlement) => {
    try {
      await updateSettlement(tripId, settlement._id, { status: 'completed' });
      await refreshData(tripId);
    } catch (error) {
      console.error('Failed to mark settlement as completed:', error);
    }
  };

  const pendingSettlements = settlements.filter(s => s.status === 'pending');
  const completedSettlements = settlements.filter(s => s.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Add Settlement Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold">Add Settlement</h2>
        
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
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'bank_transfer' | 'other')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
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

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Settlement
          </button>
        </div>
      </form>

      {/* Pending Settlements */}
      {pendingSettlements.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pending Settlements</h2>
          <div className="space-y-4">
            {pendingSettlements.map(settlement => (
              <div key={settlement._id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {participants.find(p => p._id === settlement.fromUserId)?.name} → {participants.find(p => p._id === settlement.toUserId)?.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(settlement.amount, settlement.currency)} • {settlement.method}
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
                </div>
              </div>
            ))}
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
                    {participants.find(p => p._id === settlement.fromUserId)?.name} → {participants.find(p => p._id === settlement.toUserId)?.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(settlement.amount, settlement.currency)} • {settlement.method}
                  </div>
                  {settlement.notes && (
                    <div className="text-sm text-gray-600 mt-1">{settlement.notes}</div>
                  )}
                </div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 