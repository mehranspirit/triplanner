import { Trip, Event, User } from '../types/eventTypes';
import { Expense, Settlement, ExpenseSummary } from '../types/expenseTypes';
import { offlineService, SyncOperation, TripNote, ChecklistBin } from './offlineService';
import { api } from './api';

class NetworkAwareApiService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private pendingOperations: Set<string> = new Set();
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize offline service
    this.initializeService();
    
    // Listen for network changes
    window.addEventListener('online', () => {
      console.log('Network: Back online');
      this.isOnline = true;
      this.debouncedSync();
    });

    window.addEventListener('offline', () => {
      console.log('Network: Gone offline');
      this.isOnline = false;
    });

    // Periodically check for sync when online
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.processSyncQueue();
      }
    }, 30000); // Check every 30 seconds
  }

  private async initializeService() {
    await offlineService.init();
  }

  // Debounced sync to prevent multiple sync processes
  private debouncedSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.processSyncQueue();
      this.syncTimeout = null;
    }, 1000); // Wait 1 second before syncing
  }

  // Network status methods
  getIsOnline(): boolean {
    return this.isOnline;
  }

  async hasPendingSync(): Promise<boolean> {
    const syncQueue = await offlineService.getSyncQueue();
    return syncQueue.length > 0;
  }

  // Trips API
  async getTrips(): Promise<Trip[]> {
    const cacheKey = 'trips-fetch';
    
    // Avoid duplicate requests
    if (this.pendingOperations.has(cacheKey)) {
      return await offlineService.getCachedTrips();
    }

    if (this.isOnline) {
      this.pendingOperations.add(cacheKey);
      try {
        console.log('Fetching trips from API...');
        const trips = await api.getTrips();
        await offlineService.cacheTrips(trips);
        console.log(`Cached ${trips.length} trips`);
        return trips;
      } catch (error) {
        console.error('Failed to fetch trips from API, using cache:', error);
        return await offlineService.getCachedTrips();
      } finally {
        this.pendingOperations.delete(cacheKey);
      }
    } else {
      console.log('Offline: Using cached trips');
      return await offlineService.getCachedTrips();
    }
  }

  async getTrip(tripId: string): Promise<Trip | undefined> {
    const cacheKey = `trip-${tripId}`;
    
    if (this.pendingOperations.has(cacheKey)) {
      return await offlineService.getCachedTrip(tripId);
    }

    if (this.isOnline) {
      this.pendingOperations.add(cacheKey);
      try {
        console.log(`Fetching trip ${tripId} from API...`);
        const trip = await api.getTrip(tripId);
        await offlineService.updateCachedTrip(trip);
        
        // Also cache events and expenses if they exist
        if (trip.events?.length > 0) {
          await offlineService.cacheEvents(tripId, trip.events);
        }
        
        return trip;
      } catch (error) {
        console.error(`Failed to fetch trip ${tripId} from API, using cache:`, error);
        return await offlineService.getCachedTrip(tripId);
      } finally {
        this.pendingOperations.delete(cacheKey);
      }
    } else {
      console.log(`Offline: Using cached trip ${tripId}`);
      return await offlineService.getCachedTrip(tripId);
    }
  }

  async createTrip(tripData: Omit<Trip, '_id' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
    // Generate temporary ID for offline creation
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempTrip: Trip = {
      ...tripData,
      _id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.isOnline) {
      try {
        console.log('Creating trip via API...');
        const createdTrip = await api.createTrip(tripData);
        await offlineService.updateCachedTrip(createdTrip);
        return createdTrip;
      } catch (error) {
        console.error('Failed to create trip via API, queuing for sync:', error);
        await offlineService.updateCachedTrip(tempTrip);
        await offlineService.addToSyncQueue({
          type: 'CREATE_TRIP',
          data: tripData,
          timestamp: Date.now(),
          retryCount: 0
        });
        return tempTrip;
      }
    } else {
      console.log('Offline: Caching trip for later sync');
      await offlineService.updateCachedTrip(tempTrip);
      await offlineService.addToSyncQueue({
        type: 'CREATE_TRIP',
        data: tripData,
        timestamp: Date.now(),
        retryCount: 0
      });
      return tempTrip;
    }
  }

  async updateTrip(trip: Trip): Promise<Trip> {
    // Always update cache first for optimistic UI
    const updatedTrip = { ...trip, updatedAt: new Date().toISOString() };
    await offlineService.updateCachedTrip(updatedTrip);

    if (this.isOnline) {
      try {
        console.log(`Updating trip ${trip._id} via API...`);
        const apiUpdatedTrip = await api.updateTrip(updatedTrip);
        await offlineService.updateCachedTrip(apiUpdatedTrip);
        return apiUpdatedTrip;
      } catch (error) {
        console.error('Failed to update trip via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'UPDATE_TRIP',
          data: updatedTrip,
          timestamp: Date.now(),
          retryCount: 0
        });
        return updatedTrip;
      }
    } else {
      console.log('Offline: Queuing trip update for sync');
      await offlineService.addToSyncQueue({
        type: 'UPDATE_TRIP',
        data: updatedTrip,
        timestamp: Date.now(),
        retryCount: 0
      });
      return updatedTrip;
    }
  }

  async deleteTrip(tripId: string): Promise<void> {
    // Remove from cache immediately
    await offlineService.deleteCachedTrip(tripId);

    if (this.isOnline) {
      try {
        console.log(`Deleting trip ${tripId} via API...`);
        await api.deleteTrip(tripId);
      } catch (error) {
        console.error('Failed to delete trip via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'DELETE_TRIP',
          data: { tripId },
          timestamp: Date.now(),
          retryCount: 0
        });
      }
    } else {
      console.log('Offline: Queuing trip deletion for sync');
      await offlineService.addToSyncQueue({
        type: 'DELETE_TRIP',
        data: { tripId },
        timestamp: Date.now(),
        retryCount: 0
      });
    }
  }

  // Events API (simplified - focusing on core CRUD)
  async getEvents(tripId: string): Promise<Event[]> {
    if (this.isOnline) {
      try {
        // Note: Assuming events are part of trip data
        const trip = await this.getTrip(tripId);
        return trip?.events || [];
      } catch (error) {
        console.error('Failed to fetch events, using cache:', error);
        return await offlineService.getCachedEvents(tripId);
      }
    } else {
      return await offlineService.getCachedEvents(tripId);
    }
  }

  // Expenses API
  async getExpenses(tripId: string): Promise<Expense[]> {
    const cacheKey = `expenses-${tripId}`;
    
    if (this.pendingOperations.has(cacheKey)) {
      return await offlineService.getCachedExpenses(tripId);
    }

    if (this.isOnline) {
      this.pendingOperations.add(cacheKey);
      try {
        console.log(`Fetching expenses for trip ${tripId} from API...`);
        const expenses = await api.getExpenses(tripId);
        await offlineService.cacheExpenses(tripId, expenses);
        return expenses;
      } catch (error) {
        console.error('Failed to fetch expenses from API, using cache:', error);
        return await offlineService.getCachedExpenses(tripId);
      } finally {
        this.pendingOperations.delete(cacheKey);
      }
    } else {
      console.log(`Offline: Using cached expenses for trip ${tripId}`);
      return await offlineService.getCachedExpenses(tripId);
    }
  }

  async addExpense(tripId: string, expenseData: Omit<Expense, '_id'>): Promise<Expense> {
    const tempId = `temp-expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempExpense: Expense = {
      ...expenseData,
      _id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Cache immediately for optimistic UI
    await offlineService.updateCachedExpense(tripId, tempExpense);

    if (this.isOnline) {
      try {
        console.log(`Adding expense to trip ${tripId} via API...`);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/expenses`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(expenseData),
        });

        if (!response.ok) {
          throw new Error(`Failed to add expense: ${response.statusText}`);
        }

        const realExpense = await response.json();
        
        // Remove the temporary expense from cache if it exists
        const cachedExpenses = await offlineService.getCachedExpenses(tripId);
        const tempExpense = cachedExpenses.find(e => 
          e.title === expenseData.title && 
          e.amount === expenseData.amount && 
          e._id.startsWith('temp-expense-')
        );
        
        if (tempExpense) {
          await offlineService.deleteCachedExpense(tempExpense._id);
          console.log(`Removed temporary expense ${tempExpense._id} after creating real expense ${realExpense._id}`);
        }
        
        await offlineService.updateCachedExpense(tripId, realExpense);
        return realExpense;
      } catch (error) {
        console.error('Failed to add expense via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'CREATE_EXPENSE',
          data: { ...expenseData, tempId },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
        return tempExpense;
      }
    } else {
      console.log('Offline: Queuing expense creation for sync');
      await offlineService.addToSyncQueue({
        type: 'CREATE_EXPENSE',
        data: { ...expenseData, tempId },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
      return tempExpense;
    }
  }

  async updateExpense(tripId: string, expenseId: string, updates: Partial<Expense>): Promise<Expense> {
    // Get current expense and apply updates
    const expenses = await offlineService.getCachedExpenses(tripId);
    const currentExpense = expenses.find(e => e._id === expenseId);
    if (!currentExpense) {
      throw new Error('Expense not found');
    }

    const updatedExpense = { ...currentExpense, ...updates, updatedAt: new Date().toISOString() };

    // Cache immediately for optimistic UI
    await offlineService.updateCachedExpense(tripId, updatedExpense);

    if (this.isOnline) {
      try {
        console.log(`Updating expense ${expenseId} for trip ${tripId} via API...`);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/expenses/${expenseId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update expense: ${response.statusText}`);
        }

        const realExpense = await response.json();
        await offlineService.updateCachedExpense(tripId, realExpense);
        return realExpense;
      } catch (error) {
        console.error('Failed to update expense via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'UPDATE_EXPENSE',
          data: { expenseId, updates },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
        return updatedExpense;
      }
    } else {
      console.log('Offline: Queuing expense update for sync');
      await offlineService.addToSyncQueue({
        type: 'UPDATE_EXPENSE',
        data: { expenseId, updates },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
      return updatedExpense;
    }
  }

  async deleteExpense(tripId: string, expenseId: string): Promise<void> {
    // Remove from cache immediately
    await offlineService.deleteCachedExpense(expenseId);

    if (this.isOnline) {
      try {
        console.log(`Deleting expense ${expenseId} for trip ${tripId} via API...`);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/expenses/${expenseId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to delete expense: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Failed to delete expense via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'DELETE_EXPENSE',
          data: { expenseId },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
      }
    } else {
      console.log('Offline: Queuing expense deletion for sync');
      await offlineService.addToSyncQueue({
        type: 'DELETE_EXPENSE',
        data: { expenseId },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
    }
  }

  async settleExpense(tripId: string, expenseId: string, participantId: string): Promise<void> {
    // Update expense participant status in cache
    const expenses = await offlineService.getCachedExpenses(tripId);
    const expense = expenses.find(e => e._id === expenseId);
    if (expense) {
      const updatedExpense = {
        ...expense,
        participants: expense.participants.map(p => 
          p.userId === participantId ? { ...p, settled: true } : p
        ),
        updatedAt: new Date().toISOString()
      };
      await offlineService.updateCachedExpense(tripId, updatedExpense);
    }

    if (this.isOnline) {
      try {
        console.log(`Settling expense ${expenseId} for participant ${participantId} via API...`);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/expenses/${expenseId}/settle`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ participantId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to settle expense: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Failed to settle expense via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'SETTLE_EXPENSE',
          data: { expenseId, participantId },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
      }
    } else {
      console.log('Offline: Queuing expense settlement for sync');
      await offlineService.addToSyncQueue({
        type: 'SETTLE_EXPENSE',
        data: { expenseId, participantId },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
    }
  }

  // Settlement Management - Online Only
  async getSettlements(tripId: string): Promise<Settlement[]> {
    if (!this.isOnline) {
      throw new Error('Settlements are not available offline. Please connect to the internet to manage settlements.');
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/settlements`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch settlements: ${response.statusText}`);
    }

    return await response.json();
  }

  async addSettlement(tripId: string, settlementData: Omit<Settlement, '_id'>): Promise<Settlement> {
    if (!this.isOnline) {
      throw new Error('Settlements are not available offline. Please connect to the internet to manage settlements.');
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/settlements`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settlementData),
    });

    if (!response.ok) {
      throw new Error(`Failed to add settlement: ${response.statusText}`);
    }

    return await response.json();
  }

  async updateSettlement(tripId: string, settlementId: string, updates: Partial<Settlement>): Promise<Settlement> {
    if (!this.isOnline) {
      throw new Error('Settlements are not available offline. Please connect to the internet to manage settlements.');
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/settlements/${settlementId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update settlement: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteSettlement(tripId: string, settlementId: string): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Settlements are not available offline. Please connect to the internet to manage settlements.');
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/settlements/${settlementId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete settlement: ${response.statusText}`);
    }
  }

  async getExpenseSummary(tripId: string): Promise<ExpenseSummary | undefined> {
    if (this.isOnline) {
      try {
        console.log(`Fetching expense summary for trip ${tripId} via API...`);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/expenses/summary`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch expense summary: ${response.statusText}`);
        }

        const summary = await response.json();
        await offlineService.cacheExpenseSummary(tripId, summary);
        return summary;
      } catch (error) {
        console.error('Failed to fetch expense summary via API, calculating locally:', error);
        return await this.calculateExpenseSummaryLocally(tripId);
      }
    } else {
      console.log('Offline: Calculating expense summary locally');
      return await this.calculateExpenseSummaryLocally(tripId);
    }
  }

  // Calculate expense summary locally from cached expenses
  private async calculateExpenseSummaryLocally(tripId: string): Promise<ExpenseSummary | undefined> {
    try {
      const expenses = await offlineService.getCachedExpenses(tripId);
      
      if (expenses.length === 0) {
        return {
          totalAmount: 0,
          perPersonBalances: {},
          unsettledAmount: 0,
          currency: 'USD'
        };
      }

      // Calculate total amount and per-person balances
      let totalAmount = 0;
      const perPersonBalances: Record<string, number> = {};
      const currency = expenses[0]?.currency || 'USD';

      // Process expenses
      for (const expense of expenses) {
        totalAmount += expense.amount;
        
        // Add amount paid by payer
        if (!perPersonBalances[expense.paidBy._id]) {
          perPersonBalances[expense.paidBy._id] = 0;
        }
        perPersonBalances[expense.paidBy._id] += expense.amount;

        // Subtract each participant's share
        for (const participant of expense.participants) {
          if (!perPersonBalances[participant.userId]) {
            perPersonBalances[participant.userId] = 0;
          }
          if (!participant.settled) {
            perPersonBalances[participant.userId] -= participant.share;
          }
        }
      }
      
      // Calculate unsettled amount (sum of all negative balances)
      // Note: When offline, settlements are not processed, so this shows the full unsettled amount
      const unsettledAmount = Object.values(perPersonBalances)
        .filter(balance => balance < 0)
        .reduce((sum, balance) => sum + Math.abs(balance), 0);

      const summary = {
        totalAmount,
        perPersonBalances,
        unsettledAmount,
        currency
      };

      // Cache the calculated summary
      await offlineService.cacheExpenseSummary(tripId, summary);
      
      return summary;
    } catch (error) {
      console.error('Failed to calculate expense summary locally:', error);
      // Try to return cached summary as fallback
      return await offlineService.getCachedExpenseSummary(tripId);
    }
  }

  // Debt Simplification Utility
  async simplifyDebts(tripId: string, expenseSummary: ExpenseSummary): Promise<Settlement[]> {
    const { simplifyDebts } = await import('../utils/debtSimplification');
    
    // Convert perPersonBalances to the format expected by simplifyDebts
    const balances = Object.entries(expenseSummary.perPersonBalances).map(([userId, amount]) => ({
      userId,
      amount: amount as number
    }));

    // Get simplified settlements
    const simplifiedSettlements = simplifyDebts(balances);

    // Convert to Settlement format and create them
    const settlements: Settlement[] = [];
    
    for (const settlement of simplifiedSettlements) {
      const tempId = `temp-settlement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const settlementData: Settlement = {
        _id: tempId,
        tripId,
        fromUserId: {
          _id: settlement.fromUserId,
          name: '', // Will be populated by the component
          email: ''
        },
        toUserId: {
          _id: settlement.toUserId,
          name: '', // Will be populated by the component
          email: ''
        },
        amount: settlement.amount,
        currency: expenseSummary.currency,
        status: 'pending',
        date: new Date().toISOString(),
        notes: 'Automatically generated by debt simplification'
      };

      settlements.push(settlementData);
    }

    return settlements;
  }

  // Notes API
  async getNotes(tripId: string): Promise<TripNote | undefined> {
    const cacheKey = `notes-${tripId}`;
    
    if (this.pendingOperations.has(cacheKey)) {
      return await offlineService.getCachedNotes(tripId);
    }

    if (this.isOnline) {
      this.pendingOperations.add(cacheKey);
      try {
        console.log(`Fetching notes for trip ${tripId} from API...`);
        const notes = await api.getTripNotes(tripId);
        await offlineService.cacheNotes(tripId, notes);
        return notes;
      } catch (error) {
        console.error('Failed to fetch notes from API, using cache:', error);
        return await offlineService.getCachedNotes(tripId);
      } finally {
        this.pendingOperations.delete(cacheKey);
      }
    } else {
      console.log(`Offline: Using cached notes for trip ${tripId}`);
      return await offlineService.getCachedNotes(tripId);
    }
  }

  private async getCurrentUserSafely(): Promise<any> {
    // Get user data from localStorage instead of API call to avoid fetch errors when offline
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        return JSON.parse(storedUser);
      } else {
        // Fallback: try to get from API if online
        if (this.isOnline) {
          return await api.getCurrentUser();
        } else {
          // Use default user data if offline and no stored user
          return {
            _id: 'offline-user',
            name: 'Offline User',
            email: 'offline@example.com',
            photoUrl: null
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get user data:', error);
      // Use default user data if parsing fails
      return {
        _id: 'offline-user',
        name: 'Offline User',
        email: 'offline@example.com',
        photoUrl: null
      };
    }
  }

  async updateNotes(tripId: string, content: string): Promise<TripNote> {
    const user = await this.getCurrentUserSafely();

    const tempNotes: TripNote = {
      content,
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: user
    };

    // Cache immediately for optimistic UI
    await offlineService.updateCachedNotes(tripId, tempNotes);

    if (this.isOnline) {
      try {
        console.log(`Updating notes for trip ${tripId} via API...`);
        const updatedNotes = await api.updateTripNotes(tripId, content);
        await offlineService.cacheNotes(tripId, updatedNotes);
        return updatedNotes;
      } catch (error) {
        console.error('Failed to update notes via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'UPDATE_NOTES',
          data: { content },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
        return tempNotes;
      }
    } else {
      console.log('Offline: Queuing notes update for sync');
      await offlineService.addToSyncQueue({
        type: 'UPDATE_NOTES',
        data: { content },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
      return tempNotes;
    }
  }

  // Checklist API
  async getChecklist(tripId: string, type: 'shared' | 'personal'): Promise<ChecklistBin[]> {
    const cacheKey = `checklist-${tripId}-${type}`;
    
    if (this.pendingOperations.has(cacheKey)) {
      return await offlineService.getCachedChecklist(tripId, type) || [];
    }

    if (this.isOnline) {
      this.pendingOperations.add(cacheKey);
      try {
        console.log(`Fetching ${type} checklist for trip ${tripId} from API...`);
        // Construct API endpoint dynamically
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/checklist/${type}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch checklist: ${response.statusText}`);
        }
        
        const bins = await response.json();
        await offlineService.cacheChecklist(tripId, type, bins);
        return bins;
      } catch (error) {
        console.error('Failed to fetch checklist from API, using cache:', error);
        return await offlineService.getCachedChecklist(tripId, type) || [];
      } finally {
        this.pendingOperations.delete(cacheKey);
      }
    } else {
      console.log(`Offline: Using cached ${type} checklist for trip ${tripId}`);
      return await offlineService.getCachedChecklist(tripId, type) || [];
    }
  }

  async updateChecklist(tripId: string, type: 'shared' | 'personal', bins: ChecklistBin[]): Promise<ChecklistBin[]> {
    // Cache immediately for optimistic UI
    await offlineService.updateCachedChecklist(tripId, type, bins);

    if (this.isOnline) {
      try {
        console.log(`Updating ${type} checklist for trip ${tripId} via API...`);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/checklist/${type}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bins }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update checklist: ${response.statusText}`);
        }

        await offlineService.cacheChecklist(tripId, type, bins);
        return bins;
      } catch (error) {
        console.error('Failed to update checklist via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'UPDATE_CHECKLIST',
          data: { type, bins },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
        return bins;
      }
    } else {
      console.log('Offline: Queuing checklist update for sync');
      await offlineService.addToSyncQueue({
        type: 'UPDATE_CHECKLIST',
        data: { type, bins },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
      return bins;
    }
  }

  // Event API methods
  async createEvent(tripId: string, eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>): Promise<Event> {
    const user = await this.getCurrentUserSafely();
    const tempId = `temp-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempEvent: Event = {
      ...eventData,
      id: tempId,
      createdBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: user,
      likes: [],
      dislikes: []
    };

    // Update trip in cache with optimistic event
    const cachedTrip = await offlineService.getCachedTrip(tripId);
    if (cachedTrip) {
      const updatedTrip = { ...cachedTrip, events: [...cachedTrip.events, tempEvent] };
      await offlineService.updateCachedTrip(updatedTrip);
    }

    if (this.isOnline) {
      try {
        console.log(`Creating event for trip ${tripId} via API...`);
        const updatedTrip = await this.updateTrip(cachedTrip ? { ...cachedTrip, events: [...cachedTrip.events, tempEvent] } : tempEvent as any);
        return tempEvent; // Return the new event
      } catch (error) {
        console.error('Failed to create event via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'CREATE_EVENT',
          data: eventData,
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
        return tempEvent;
      }
    } else {
      console.log('Offline: Queuing event creation for sync');
      await offlineService.addToSyncQueue({
        type: 'CREATE_EVENT',
        data: eventData,
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
      return tempEvent;
    }
  }

  async updateEvent(tripId: string, event: Event): Promise<Event> {
    // Update trip in cache with optimistic event update
    const cachedTrip = await offlineService.getCachedTrip(tripId);
    if (cachedTrip) {
      const updatedEvents = cachedTrip.events.map(e => e.id === event.id ? event : e);
      const updatedTrip = { ...cachedTrip, events: updatedEvents };
      await offlineService.updateCachedTrip(updatedTrip);
    }

    if (this.isOnline) {
      try {
        console.log(`Updating event ${event.id} for trip ${tripId} via API...`);
        await this.updateTrip(cachedTrip ? { ...cachedTrip, events: cachedTrip.events.map(e => e.id === event.id ? event : e) } : event as any);
        return event;
      } catch (error) {
        console.error('Failed to update event via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'UPDATE_EVENT',
          data: event,
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
        return event;
      }
    } else {
      console.log('Offline: Queuing event update for sync');
      await offlineService.addToSyncQueue({
        type: 'UPDATE_EVENT',
        data: event,
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
      return event;
    }
  }

  async deleteEvent(tripId: string, eventId: string): Promise<void> {
    // Remove from trip in cache
    const cachedTrip = await offlineService.getCachedTrip(tripId);
    if (cachedTrip) {
      const updatedEvents = cachedTrip.events.filter(e => e.id !== eventId);
      const updatedTrip = { ...cachedTrip, events: updatedEvents };
      await offlineService.updateCachedTrip(updatedTrip);
    }

    if (this.isOnline) {
      try {
        console.log(`Deleting event ${eventId} for trip ${tripId} via API...`);
        await this.updateTrip(cachedTrip ? { ...cachedTrip, events: cachedTrip.events.filter(e => e.id !== eventId) } : {} as any);
      } catch (error) {
        console.error('Failed to delete event via API, queuing for sync:', error);
        await offlineService.addToSyncQueue({
          type: 'DELETE_EVENT',
          data: { eventId },
          tripId,
          timestamp: Date.now(),
          retryCount: 0
        });
      }
    } else {
      console.log('Offline: Queuing event deletion for sync');
      await offlineService.addToSyncQueue({
        type: 'DELETE_EVENT',
        data: { eventId },
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      });
    }
  }

  // Sync Queue Processing
  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    console.log('Processing sync queue...');

    try {
      let syncQueue = await offlineService.getSyncQueue();
      
      if (syncQueue.length === 0) {
        console.log('Sync queue is empty');
        return;
      }
      
      // Optimize sync queue by removing conflicting operations for temporary items
      syncQueue = await this.optimizeSyncQueue(syncQueue);
      
      for (const operation of syncQueue) {
        try {
          // Ensure operation has an ID
          if (!operation.id) {
            console.error(`Operation ${operation.type} has no ID, skipping`);
            continue;
          }
          
          await this.processSyncOperation(operation);
          
          // Remove operation from sync queue (operation.id is guaranteed to exist due to check above)
          await offlineService.removeSyncOperation(operation.id!);
          console.log(`✓ Synced and removed operation: ${operation.type} (ID: ${operation.id})`);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.type} (ID: ${operation.id}):`, error);
          
          // Update retry count
          operation.retryCount++;
          
          // Remove from queue if too many retries
          if (operation.retryCount >= 3) {
            console.warn(`Removing operation ${operation.type} after 3 failed attempts`);
            if (operation.id) {
              await offlineService.removeSyncOperation(operation.id);
            }
          } else {
            await offlineService.updateSyncOperation(operation);
          }
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Optimize sync queue by removing conflicting operations for temporary items
  private async optimizeSyncQueue(syncQueue: SyncOperation[]): Promise<SyncOperation[]> {
    const optimizedQueue: SyncOperation[] = [];
    const tempItemOperations = new Map<string, SyncOperation[]>();

    // Group operations by temporary item ID
    for (const operation of syncQueue) {
      let tempId: string | null = null;
      
      if (operation.type === 'CREATE_EXPENSE' && operation.data.tempId) {
        tempId = operation.data.tempId;
      } else if (operation.type === 'DELETE_EXPENSE' && operation.data.expenseId?.startsWith('temp-expense-')) {
        tempId = operation.data.expenseId;
      } else if (operation.type === 'UPDATE_EXPENSE' && operation.data._id?.startsWith('temp-expense-')) {
        tempId = operation.data._id;
      } else if (operation.type === 'SETTLE_EXPENSE' && operation.data.expenseId?.startsWith('temp-expense-')) {
        tempId = operation.data.expenseId;
      }

      if (tempId) {
        if (!tempItemOperations.has(tempId)) {
          tempItemOperations.set(tempId, []);
        }
        tempItemOperations.get(tempId)!.push(operation);
      } else {
        // Keep non-temporary operations
        optimizedQueue.push(operation);
      }
    }

    // Process temporary item operations
    for (const [tempId, operations] of tempItemOperations) {
      const hasCreate = operations.some(op => op.type.startsWith('CREATE_'));
      const hasDelete = operations.some(op => op.type.startsWith('DELETE_'));
      
      if (hasCreate && hasDelete) {
        // If both create and delete exist, skip all operations for this temp item
        console.log(`Skipping sync for temporary item ${tempId} (created and deleted offline)`);
        
        // Remove the temporary item from cache as well
        if (tempId.startsWith('temp-expense-')) {
          await offlineService.deleteCachedExpense(tempId);
          console.log(`Removed temporary expense ${tempId} from cache (created and deleted offline)`);
        }
        
        // Remove these operations from the sync queue
        for (const operation of operations) {
          if (operation.id) {
            await offlineService.removeSyncOperation(operation.id);
          }
        }
      } else {
        // Keep operations that don't have both create and delete
        optimizedQueue.push(...operations);
      }
    }

    return optimizedQueue;
  }

  private async processSyncOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'CREATE_TRIP':
        const createdTrip = await api.createTrip(operation.data);
        await offlineService.updateCachedTrip(createdTrip);
        break;
        
      case 'UPDATE_TRIP':
        const updatedTrip = await api.updateTrip(operation.data);
        await offlineService.updateCachedTrip(updatedTrip);
        break;
        
      case 'DELETE_TRIP':
        await api.deleteTrip(operation.data.tripId);
        break;
        
      case 'CREATE_EXPENSE':
        // Remove tempId from data before sending to API
        const { tempId: operationTempId, ...expenseDataForAPI } = operation.data;
        const createdExpense = await api.addExpense(operation.tripId!, expenseDataForAPI);
        
        // Remove the temporary expense from cache if tempId is available
        if (operationTempId) {
          await offlineService.deleteCachedExpense(operationTempId);
          console.log(`Removed temporary expense ${operationTempId} after creating real expense ${createdExpense._id}`);
        } else {
          // Fallback: find by matching title and amount
          const cachedExpenses = await offlineService.getCachedExpenses(operation.tripId!);
          const tempExpense = cachedExpenses.find(e => 
            e.title === operation.data.title && 
            e.amount === operation.data.amount && 
            e._id.startsWith('temp-expense-')
          );
          
          if (tempExpense) {
            await offlineService.deleteCachedExpense(tempExpense._id);
            console.log(`Removed temporary expense ${tempExpense._id} after creating real expense ${createdExpense._id}`);
          }
        }
        
        await offlineService.updateCachedExpense(operation.tripId!, createdExpense);
        break;
        
      case 'UPDATE_EXPENSE':
        // Skip updating expenses with temporary IDs
        if (operation.data.expenseId && operation.data.expenseId.startsWith('temp-expense-')) {
          console.log(`Skipping update of temporary expense: ${operation.data.expenseId}`);
          break;
        }
        const updatedExpense = await api.updateExpense(
          operation.tripId!, 
          operation.data.expenseId, 
          operation.data.updates
        );
        await offlineService.updateCachedExpense(operation.tripId!, updatedExpense);
        break;
        
      case 'DELETE_EXPENSE':
        // Skip deleting temporary expenses since they never existed on the server
        if (operation.data.expenseId.startsWith('temp-expense-')) {
          console.log(`Skipping delete of temporary expense: ${operation.data.expenseId}`);
          break;
        }
        await api.deleteExpense(operation.tripId!, operation.data.expenseId);
        break;
        
      case 'SETTLE_EXPENSE':
        // Skip settling expenses with temporary IDs
        if (operation.data.expenseId.startsWith('temp-expense-')) {
          console.log(`Skipping settle of temporary expense: ${operation.data.expenseId}`);
          break;
        }
        await api.settleExpense(operation.tripId!, operation.data.expenseId, operation.data.participantId);
        break;
        


      case 'UPDATE_NOTES':
        const updatedNotes = await api.updateTripNotes(operation.tripId!, operation.data.content);
        await offlineService.cacheNotes(operation.tripId!, updatedNotes);
        break;

      case 'UPDATE_CHECKLIST':
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${operation.tripId}/checklist/${operation.data.type}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bins: operation.data.bins }),
        });
        if (!response.ok) {
          throw new Error(`Failed to sync checklist: ${response.statusText}`);
        }
        await offlineService.cacheChecklist(operation.tripId!, operation.data.type, operation.data.bins);
        break;

      case 'CREATE_EVENT':
      case 'UPDATE_EVENT':
      case 'DELETE_EVENT':
        // These are handled through trip updates
        console.log(`Event operation ${operation.type} will be handled through trip sync`);
        break;
        
      default:
        console.warn(`Unknown sync operation type: ${operation.type}`);
    }
  }

  // Manual sync trigger
  async forcSync(): Promise<void> {
    if (this.isOnline) {
      await this.processSyncQueue();
    }
  }

  // Storage info
  async getStorageInfo(): Promise<{ used: number; quota: number; pendingSync: number }> {
    const storage = await offlineService.getStorageSize();
    const syncQueue = await offlineService.getSyncQueue();
    
    return {
      used: storage.used,
      quota: storage.quota,
      pendingSync: syncQueue.length
    };
  }

  // Enhanced cache management methods
  async getCacheStatistics(): Promise<{
    totalRecords: number;
    byStore: Record<string, number>;
    storageUsed: number;
    storageQuota: number;
    lastSyncTimes: Record<string, number>;
    pendingSyncOps: number;
  }> {
    return await offlineService.getCacheStats();
  }

  async clearExpiredCache(maxAgeInDays: number = 7): Promise<void> {
    const maxAgeMs = maxAgeInDays * 24 * 60 * 60 * 1000;
    await offlineService.clearExpiredCache(maxAgeMs);
  }

  async optimizeStorage(): Promise<void> {
    await offlineService.optimizeDatabase();
  }

  async validateCacheIntegrity(): Promise<{ isValid: boolean; issues: string[] }> {
    return await offlineService.validateCache();
  }

  // Preload critical data for better offline experience
  async preloadCriticalData(tripIds: string[] = []): Promise<void> {
    if (!this.isOnline) {
      console.log('Cannot preload data while offline');
      return;
    }

    try {
      console.log('Preloading critical data for offline access...');
      
      // Preload all trips if no specific trips provided
      if (tripIds.length === 0) {
        const trips = await this.getTrips();
        tripIds = trips.map(t => t._id);
      }

      // Preload detailed data for each trip
      for (const tripId of tripIds) {
        try {
          await Promise.all([
            this.getTrip(tripId),
            this.getExpenses(tripId),
            this.getSettlements(tripId),
            this.getExpenseSummary(tripId),
            this.getNotes(tripId),
            this.getChecklist(tripId, 'shared'),
            this.getChecklist(tripId, 'personal')
          ]);
          console.log(`Preloaded data for trip ${tripId}`);
        } catch (error) {
          console.warn(`Failed to preload data for trip ${tripId}:`, error);
        }
      }

      console.log('Critical data preloading completed');
    } catch (error) {
      console.error('Failed to preload critical data:', error);
    }
  }

  // Smart cache refresh - only refresh stale data
  async smartRefresh(tripId: string, maxAge: number = 5 * 60 * 1000): Promise<void> {
    if (!this.isOnline) return;

    const now = Date.now();
    const stats = await this.getCacheStatistics();

    // Check if trip data is stale
    const tripLastSync = stats.lastSyncTimes.trips || 0;
    if (now - tripLastSync > maxAge) {
      await this.getTrip(tripId);
    }

    // Check if expenses data is stale
    const expensesLastSync = stats.lastSyncTimes.expenses || 0;
    if (now - expensesLastSync > maxAge) {
      await this.getExpenses(tripId);
      await this.getExpenseSummary(tripId);
    }

    // Check if settlements data is stale
    const settlementsLastSync = stats.lastSyncTimes.settlements || 0;
    if (now - settlementsLastSync > maxAge) {
      await this.getSettlements(tripId);
    }
  }

  // Batch operations for better performance
  async batchUpdateExpenses(tripId: string, expenses: Expense[]): Promise<void> {
    await offlineService.batchUpdateExpenses(tripId, expenses);
  }

  async batchUpdateSettlements(tripId: string, settlements: Settlement[]): Promise<void> {
    await offlineService.batchUpdateSettlements(tripId, settlements);
  }

  // Cache warming - preload data in background
  async warmCache(): Promise<void> {
    if (!this.isOnline) return;

    console.log('Warming cache with background data loading...');
    
    try {
      // Load trips list first
      const trips = await this.getTrips();
      
      // Load recent trips data in background
      const recentTrips = trips
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5); // Only warm cache for 5 most recent trips

      for (const trip of recentTrips) {
        // Load in background without blocking
        setTimeout(async () => {
          try {
            await this.preloadCriticalData([trip._id]);
          } catch (error) {
            console.warn(`Background cache warming failed for trip ${trip._id}:`, error);
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Cache warming failed:', error);
    }
  }

  // Comprehensive preload for a specific trip
  async preloadTripData(tripId: string): Promise<void> {
    if (!this.isOnline) {
      console.log('Cannot preload trip data while offline');
      return;
    }

    try {
      console.log(`Preloading comprehensive data for trip ${tripId}...`);
      
      // Load all trip-related data in parallel
      const [trip, expenses, settlements, expenseSummary, notes, sharedChecklist, personalChecklist] = await Promise.allSettled([
        this.getTrip(tripId),
        this.getExpenses(tripId),
        this.getSettlements(tripId),
        this.getExpenseSummary(tripId),
        this.getNotes(tripId),
        this.getChecklist(tripId, 'shared'),
        this.getChecklist(tripId, 'personal')
      ]);

      // Log results
      const successful = [trip, expenses, settlements, expenseSummary, notes, sharedChecklist, personalChecklist]
        .filter(result => result.status === 'fulfilled').length;
      
      console.log(`Preloaded ${successful}/7 data types for trip ${tripId}`);
      
      // Log any failures for debugging
      if (trip.status === 'rejected') console.warn('Failed to preload trip:', trip.reason);
      if (expenses.status === 'rejected') console.warn('Failed to preload expenses:', expenses.reason);
      if (settlements.status === 'rejected') console.warn('Failed to preload settlements:', settlements.reason);
      if (expenseSummary.status === 'rejected') console.warn('Failed to preload expense summary:', expenseSummary.reason);
      if (notes.status === 'rejected') console.warn('Failed to preload notes:', notes.reason);
      if (sharedChecklist.status === 'rejected') console.warn('Failed to preload shared checklist:', sharedChecklist.reason);
      if (personalChecklist.status === 'rejected') console.warn('Failed to preload personal checklist:', personalChecklist.reason);

    } catch (error) {
      console.error(`Failed to preload trip data for ${tripId}:`, error);
    }
  }
}

export const networkAwareApi = new NetworkAwareApiService(); 