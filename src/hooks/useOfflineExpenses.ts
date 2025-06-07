import { useState, useEffect, useCallback } from 'react';
import { Expense, Settlement, ExpenseSummary } from '../types/expenseTypes';
import { User } from '../types/eventTypes';
import { networkAwareApi } from '../services/networkAwareApi';
import { simplifyDebts } from '../utils/debtSimplification';

interface UseOfflineExpensesResult {
  // Data
  expenses: Expense[];
  settlements: Settlement[];
  expenseSummary: ExpenseSummary | undefined;
  
  // Status
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  hasPendingSync: boolean;
  
  // Expense Operations
  addExpense: (expenseData: Omit<Expense, '_id'>) => Promise<Expense>;
  updateExpense: (expenseId: string, updates: Partial<Expense>) => Promise<Expense>;
  deleteExpense: (expenseId: string) => Promise<void>;
  settleExpense: (expenseId: string, participantId: string) => Promise<void>;
  
  // Settlement Operations
  addSettlement: (settlementData: Omit<Settlement, '_id'>) => Promise<Settlement>;
  updateSettlement: (settlementId: string, updates: Partial<Settlement>) => Promise<Settlement>;
  markSettlementCompleted: (settlementId: string, method?: 'cash' | 'bank_transfer' | 'venmo' | 'other') => Promise<Settlement>;
  
  // Debt Simplification
  simplifyDebts: (participants: User[]) => Promise<Settlement[]>;
  
  // Data Management
  refreshData: () => Promise<void>;
  forcSync: () => Promise<void>;
}

export function useOfflineExpenses(tripId: string): UseOfflineExpensesResult {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(networkAwareApi.getIsOnline());
  const [hasPendingSync, setHasPendingSync] = useState(false);

  // Network status monitoring
  useEffect(() => {
    const checkNetworkStatus = async () => {
      setIsOnline(networkAwareApi.getIsOnline());
      setHasPendingSync(await networkAwareApi.hasPendingSync());
    };

    const interval = setInterval(checkNetworkStatus, 5000);
    checkNetworkStatus();

    return () => clearInterval(interval);
  }, []);

  // Load initial data
  const loadData = useCallback(async () => {
    if (!tripId) return;
    
    try {
      setLoading(true);
      setError(null);

      const [expensesData, settlementsData, summaryData] = await Promise.all([
        networkAwareApi.getExpenses(tripId),
        networkAwareApi.getSettlements(tripId),
        networkAwareApi.getExpenseSummary(tripId)
      ]);

      setExpenses(expensesData);
      setSettlements(settlementsData);
      setExpenseSummary(summaryData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load expense data';
      setError(errorMessage);
      console.error('Error loading expense data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Expense Operations
  const addExpense = useCallback(async (expenseData: Omit<Expense, '_id'>): Promise<Expense> => {
    try {
      setError(null);
      const newExpense = await networkAwareApi.addExpense(tripId, expenseData);
      
      // Optimistically update local state
      setExpenses(prev => [...prev, newExpense]);
      
      // Refresh summary to get updated balances
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      if (updatedSummary) {
        setExpenseSummary(updatedSummary);
      }
      
      return newExpense;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add expense';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId]);

  const updateExpense = useCallback(async (expenseId: string, updates: Partial<Expense>): Promise<Expense> => {
    try {
      setError(null);
      const updatedExpense = await networkAwareApi.updateExpense(tripId, expenseId, updates);
      
      // Optimistically update local state
      setExpenses(prev => prev.map(exp => 
        exp._id === expenseId ? updatedExpense : exp
      ));
      
      // Refresh summary to get updated balances
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      if (updatedSummary) {
        setExpenseSummary(updatedSummary);
      }
      
      return updatedExpense;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update expense';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId]);

  const deleteExpense = useCallback(async (expenseId: string): Promise<void> => {
    try {
      setError(null);
      await networkAwareApi.deleteExpense(tripId, expenseId);
      
      // Optimistically update local state
      setExpenses(prev => prev.filter(exp => exp._id !== expenseId));
      
      // Refresh summary to get updated balances
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      if (updatedSummary) {
        setExpenseSummary(updatedSummary);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete expense';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId]);

  const settleExpense = useCallback(async (expenseId: string, participantId: string): Promise<void> => {
    try {
      setError(null);
      await networkAwareApi.settleExpense(tripId, expenseId, participantId);
      
      // Optimistically update local state
      setExpenses(prev => prev.map(exp => 
        exp._id === expenseId 
          ? {
              ...exp,
              participants: exp.participants.map(p => 
                p.userId === participantId ? { ...p, settled: true } : p
              )
            }
          : exp
      ));
      
      // Refresh summary to get updated balances
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      if (updatedSummary) {
        setExpenseSummary(updatedSummary);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to settle expense';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId]);

  // Settlement Operations
  const addSettlement = useCallback(async (settlementData: Omit<Settlement, '_id'>): Promise<Settlement> => {
    try {
      setError(null);
      const newSettlement = await networkAwareApi.addSettlement(tripId, settlementData);
      
      // Optimistically update local state
      setSettlements(prev => [...prev, newSettlement]);
      
      // Refresh summary to get updated balances
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      if (updatedSummary) {
        setExpenseSummary(updatedSummary);
      }
      
      return newSettlement;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add settlement';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId]);

  const updateSettlement = useCallback(async (settlementId: string, updates: Partial<Settlement>): Promise<Settlement> => {
    try {
      setError(null);
      const updatedSettlement = await networkAwareApi.updateSettlement(tripId, settlementId, updates);
      
      // Optimistically update local state
      setSettlements(prev => prev.map(settlement => 
        settlement._id === settlementId ? updatedSettlement : settlement
      ));
      
      // Refresh summary to get updated balances
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      if (updatedSummary) {
        setExpenseSummary(updatedSummary);
      }
      
      return updatedSettlement;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settlement';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId]);

  const markSettlementCompleted = useCallback(async (
    settlementId: string, 
    method: 'cash' | 'bank_transfer' | 'venmo' | 'other' = 'cash'
  ): Promise<Settlement> => {
    return updateSettlement(settlementId, { status: 'completed', method });
  }, [updateSettlement]);

  // Debt Simplification
  const simplifyDebtsOperation = useCallback(async (participants: User[]): Promise<Settlement[]> => {
    if (!expenseSummary) {
      throw new Error('No expense summary available for debt simplification');
    }

    try {
      setError(null);
      
      // Generate simplified settlements
      const simplifiedSettlements = await networkAwareApi.simplifyDebts(tripId, expenseSummary);
      
      // Create settlements with proper user information
      const settlementsToCreate: Settlement[] = simplifiedSettlements.map(settlement => {
        const fromUser = participants.find(p => p._id === settlement.fromUserId._id);
        const toUser = participants.find(p => p._id === settlement.toUserId._id);
        
        if (!fromUser || !toUser) {
          throw new Error('Participant not found for debt simplification');
        }
        
        return {
          ...settlement,
          fromUserId: {
            _id: fromUser._id,
            name: fromUser.name,
            email: fromUser.email
          },
          toUserId: {
            _id: toUser._id,
            name: toUser.name,
            email: toUser.email
          }
        };
      });
      
      // Create all settlements
      const createdSettlements: Settlement[] = [];
      for (const settlementData of settlementsToCreate) {
        const { _id, ...dataWithoutId } = settlementData;
        const created = await addSettlement(dataWithoutId);
        createdSettlements.push(created);
      }
      
      return createdSettlements;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to simplify debts';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tripId, expenseSummary, addSettlement]);

  // Data Management
  const refreshData = useCallback(async (): Promise<void> => {
    await loadData();
  }, [loadData]);

  const forcSync = useCallback(async (): Promise<void> => {
    try {
      await networkAwareApi.forcSync();
      await refreshData();
    } catch (err) {
      console.error('Force sync failed:', err);
    }
  }, [refreshData]);

  return {
    // Data
    expenses,
    settlements,
    expenseSummary,
    
    // Status
    loading,
    error,
    isOnline,
    hasPendingSync,
    
    // Expense Operations
    addExpense,
    updateExpense,
    deleteExpense,
    settleExpense,
    
    // Settlement Operations
    addSettlement,
    updateSettlement,
    markSettlementCompleted,
    
    // Debt Simplification
    simplifyDebts: simplifyDebtsOperation,
    
    // Data Management
    refreshData,
    forcSync
  };
} 