import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Trip, Event } from '../types/eventTypes';
import { Expense, Settlement, ExpenseSummary } from '../types/expenseTypes';

export interface SyncOperation {
  id?: number;
  type: 'CREATE_TRIP' | 'UPDATE_TRIP' | 'DELETE_TRIP' | 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT' | 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE' | 'SETTLE_EXPENSE' | 'CREATE_SETTLEMENT' | 'UPDATE_SETTLEMENT' | 'UPDATE_NOTES' | 'UPDATE_CHECKLIST';
  data: any;
  timestamp: number;
  tripId?: string;
  retryCount: number;
}

export interface TripNote {
  content: string;
  lastEditedAt: string;
  lastEditedBy: {
    _id: string;
    name: string;
    email: string;
    photoUrl?: string | null;
  };
}

export interface ChecklistBin {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TripPlannerDB extends DBSchema {
  trips: {
    key: string;
    value: Trip & { lastSync: number };
  };
  events: {
    key: string;
    value: Event & { tripId: string; lastSync: number };
    indexes: { 'by-trip': string };
  };
  expenses: {
    key: string;
    value: Expense & { lastSync: number };
    indexes: { 'by-trip': string };
  };
  settlements: {
    key: string;
    value: Settlement & { lastSync: number };
    indexes: { 'by-trip': string };
  };
  expenseSummaries: {
    key: string; // tripId
    value: ExpenseSummary & { tripId: string; lastSync: number };
  };
  notes: {
    key: string; // tripId
    value: TripNote & { tripId: string; lastSync: number };
  };
  checklists: {
    key: string; // `${tripId}-${type}` (shared/personal)
    value: { key: string; tripId: string; type: 'shared' | 'personal'; bins: ChecklistBin[]; lastSync: number };
  };
  syncQueue: {
    key: number;
    value: SyncOperation;
    indexes: { 'by-type': string };
  };
  metadata: {
    key: string;
    value: any;
  };
}

class OfflineService {
  private db: IDBPDatabase<TripPlannerDB> | null = null;
  private dbName = 'triplanner-offline';
  private dbVersion = 2;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<TripPlannerDB>(this.dbName, this.dbVersion, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create trips store
        if (!db.objectStoreNames.contains('trips')) {
          db.createObjectStore('trips', { keyPath: '_id' });
        }

        // Create events store
        if (!db.objectStoreNames.contains('events')) {
          const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
          eventsStore.createIndex('by-trip', 'tripId');
        }

        // Create expenses store
        if (!db.objectStoreNames.contains('expenses')) {
          const expensesStore = db.createObjectStore('expenses', { keyPath: '_id' });
          expensesStore.createIndex('by-trip', 'tripId');
        }

        // Create settlements store (new)
        if (!db.objectStoreNames.contains('settlements')) {
          const settlementsStore = db.createObjectStore('settlements', { keyPath: '_id' });
          settlementsStore.createIndex('by-trip', 'tripId');
        }

        // Create expense summaries store (new)
        if (!db.objectStoreNames.contains('expenseSummaries')) {
          db.createObjectStore('expenseSummaries', { keyPath: 'tripId' });
        }

        // Create notes store
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'tripId' });
        }

        // Create checklists store
        if (!db.objectStoreNames.contains('checklists')) {
          db.createObjectStore('checklists', { keyPath: 'key' });
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('by-type', 'type');
        }

        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      }
    });
  }

  // Trips Methods
  async cacheTrips(trips: Trip[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('trips', 'readwrite');
    const now = Date.now();
    
    await Promise.all(
      trips.map(trip => 
        tx.store.put({ ...trip, lastSync: now })
      )
    );
    await tx.done;
  }

  async getCachedTrips(): Promise<Trip[]> {
    if (!this.db) await this.init();
    const trips = await this.db!.getAll('trips');
    return trips.map(({ lastSync, ...trip }) => trip);
  }

  async getCachedTrip(tripId: string): Promise<Trip | undefined> {
    if (!this.db) await this.init();
    const trip = await this.db!.get('trips', tripId);
    if (!trip) return undefined;
    const { lastSync, ...tripData } = trip;
    return tripData;
  }

  async updateCachedTrip(trip: Trip): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('trips', { ...trip, lastSync: Date.now() });
  }

  async deleteCachedTrip(tripId: string): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(['trips', 'events', 'expenses', 'settlements', 'expenseSummaries'], 'readwrite');
    
    await Promise.all([
      tx.objectStore('trips').delete(tripId),
      // Delete all related events, expenses, and settlements
      this.deleteEventsByTrip(tripId),
      this.deleteExpensesByTrip(tripId),
      this.deleteSettlementsByTrip(tripId),
      this.deleteCachedExpenseSummary(tripId)
    ]);
    
    await tx.done;
  }

  // Events Methods
  async cacheEvents(tripId: string, events: Event[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('events', 'readwrite');
    const now = Date.now();
    
    await Promise.all(
      events.map(event => 
        tx.store.put({ ...event, tripId, lastSync: now })
      )
    );
    await tx.done;
  }

  async getCachedEvents(tripId: string): Promise<Event[]> {
    if (!this.db) await this.init();
    const events = await this.db!.getAllFromIndex('events', 'by-trip', tripId);
    return events.map(({ tripId: tid, lastSync, ...event }) => event);
  }

  async updateCachedEvent(tripId: string, event: Event): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('events', { ...event, tripId, lastSync: Date.now() });
  }

  async deleteCachedEvent(eventId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('events', eventId);
  }

  private async deleteEventsByTrip(tripId: string): Promise<void> {
    if (!this.db) await this.init();
    const events = await this.db!.getAllFromIndex('events', 'by-trip', tripId);
    const tx = this.db!.transaction('events', 'readwrite');
    
    await Promise.all(
      events.map(event => tx.store.delete(event.id))
    );
    await tx.done;
  }

  // Expenses Methods
  async cacheExpenses(tripId: string, expenses: Expense[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('expenses', 'readwrite');
    const now = Date.now();
    
    await Promise.all(
      expenses.map(expense => 
        tx.store.put({ ...expense, tripId, lastSync: now })
      )
    );
    await tx.done;
  }

  async getCachedExpenses(tripId: string): Promise<Expense[]> {
    if (!this.db) await this.init();
    const expenses = await this.db!.getAllFromIndex('expenses', 'by-trip', tripId);
    return expenses.map(({ lastSync, ...expense }) => expense);
  }

  async updateCachedExpense(tripId: string, expense: Expense): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('expenses', { ...expense, tripId, lastSync: Date.now() });
  }

  async deleteCachedExpense(expenseId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('expenses', expenseId);
  }

  private async deleteExpensesByTrip(tripId: string): Promise<void> {
    if (!this.db) await this.init();
    const expenses = await this.db!.getAllFromIndex('expenses', 'by-trip', tripId);
    const tx = this.db!.transaction('expenses', 'readwrite');
    
    await Promise.all(
      expenses.map(expense => tx.store.delete(expense._id))
    );
    await tx.done;
  }

  // Notes Methods
  async cacheNotes(tripId: string, notes: TripNote): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('notes', { ...notes, tripId, lastSync: Date.now() });
  }

  async getCachedNotes(tripId: string): Promise<TripNote | undefined> {
    if (!this.db) await this.init();
    const result = await this.db!.get('notes', tripId);
    if (!result) return undefined;
    const { tripId: tid, lastSync, ...notes } = result;
    return notes;
  }

  async updateCachedNotes(tripId: string, notes: TripNote): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('notes', { ...notes, tripId, lastSync: Date.now() });
  }

  async deleteCachedNotes(tripId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('notes', tripId);
  }

  // Checklist Methods
  async cacheChecklist(tripId: string, type: 'shared' | 'personal', bins: ChecklistBin[]): Promise<void> {
    if (!this.db) await this.init();
    const key = `${tripId}-${type}`;
    await this.db!.put('checklists', { key, tripId, type, bins, lastSync: Date.now() });
  }

  async getCachedChecklist(tripId: string, type: 'shared' | 'personal'): Promise<ChecklistBin[] | undefined> {
    if (!this.db) await this.init();
    const key = `${tripId}-${type}`;
    const result = await this.db!.get('checklists', key);
    return result?.bins;
  }

  async updateCachedChecklist(tripId: string, type: 'shared' | 'personal', bins: ChecklistBin[]): Promise<void> {
    if (!this.db) await this.init();
    const key = `${tripId}-${type}`;
    await this.db!.put('checklists', { key, tripId, type, bins, lastSync: Date.now() });
  }

  async deleteCachedChecklist(tripId: string, type: 'shared' | 'personal'): Promise<void> {
    if (!this.db) await this.init();
    const key = `${tripId}-${type}`;
    await this.db!.delete('checklists', key);
  }

  // Sync Queue Methods
  async addToSyncQueue(operation: Omit<SyncOperation, 'id'>): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.add('syncQueue', {
      ...operation,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  async getSyncQueue(): Promise<SyncOperation[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('syncQueue');
  }

  async removeSyncOperation(id: number): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('syncQueue', id);
  }

  async updateSyncOperation(operation: SyncOperation): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('syncQueue', operation);
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('syncQueue');
  }

  // Metadata Methods
  async setMetadata(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('metadata', { key, value, timestamp: Date.now() });
  }

  async getMetadata(key: string): Promise<any> {
    if (!this.db) await this.init();
    const result = await this.db!.get('metadata', key);
    return result?.value;
  }

  // Settlement Methods
  async cacheSettlements(tripId: string, settlements: Settlement[]): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('settlements', 'readwrite');
    const now = Date.now();
    
    await Promise.all(
      settlements.map(settlement => 
        tx.store.put({ ...settlement, lastSync: now })
      )
    );
    await tx.done;
  }

  async getCachedSettlements(tripId: string): Promise<Settlement[]> {
    if (!this.db) await this.init();
    const settlements = await this.db!.getAllFromIndex('settlements', 'by-trip', tripId);
    return settlements.map(({ lastSync, ...settlement }) => settlement);
  }

  async updateCachedSettlement(settlement: Settlement): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('settlements', { ...settlement, lastSync: Date.now() });
  }

  async deleteCachedSettlement(settlementId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('settlements', settlementId);
  }

  private async deleteSettlementsByTrip(tripId: string): Promise<void> {
    if (!this.db) await this.init();
    const settlements = await this.db!.getAllFromIndex('settlements', 'by-trip', tripId);
    const tx = this.db!.transaction('settlements', 'readwrite');
    await Promise.all(settlements.map(settlement => tx.store.delete(settlement._id)));
    await tx.done;
  }

  // Expense Summary Methods
  async cacheExpenseSummary(tripId: string, summary: ExpenseSummary): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('expenseSummaries', { ...summary, tripId, lastSync: Date.now() });
  }

  async getCachedExpenseSummary(tripId: string): Promise<ExpenseSummary | undefined> {
    if (!this.db) await this.init();
    const result = await this.db!.get('expenseSummaries', tripId);
    if (!result) return undefined;
    const { tripId: tid, lastSync, ...summary } = result;
    return summary;
  }

  async deleteCachedExpenseSummary(tripId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('expenseSummaries', tripId);
  }

  // Utility Methods
  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  async getStorageSize(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { used: 0, quota: 0 };
  }

  // Enhanced cache management
  async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    
    const stores = ['trips', 'events', 'expenses', 'settlements', 'expenseSummaries', 'notes', 'checklists', 'syncQueue'] as const;
    const tx = this.db!.transaction([...stores], 'readwrite');
    
    await Promise.all([
      tx.objectStore('trips').clear(),
      tx.objectStore('events').clear(),
      tx.objectStore('expenses').clear(),
      tx.objectStore('settlements').clear(),
      tx.objectStore('expenseSummaries').clear(),
      tx.objectStore('notes').clear(),
      tx.objectStore('checklists').clear(),
      tx.objectStore('syncQueue').clear()
    ]);
    await tx.done;
    
    console.log('All offline cache cleared');
  }

  // Selective cache clearing for optimization
  async clearExpiredCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init();
    
    const cutoffTime = Date.now() - maxAge;
    
    // Clear expired trips
    const trips = await this.db!.getAll('trips');
    const expiredTrips = trips.filter(item => item.lastSync < cutoffTime);
    for (const trip of expiredTrips) {
      await this.db!.delete('trips', trip._id);
    }
    
    // Clear expired events
    const events = await this.db!.getAll('events');
    const expiredEvents = events.filter(item => item.lastSync < cutoffTime);
    for (const event of expiredEvents) {
      await this.db!.delete('events', event.id);
    }
    
    // Clear expired expenses
    const expenses = await this.db!.getAll('expenses');
    const expiredExpenses = expenses.filter(item => item.lastSync < cutoffTime);
    for (const expense of expiredExpenses) {
      await this.db!.delete('expenses', expense._id);
    }
    
    console.log(`Cleared ${expiredTrips.length + expiredEvents.length + expiredExpenses.length} expired items`);
  }

  // Batch operations for better performance
  async batchUpdateExpenses(tripId: string, expenses: Expense[]): Promise<void> {
    if (!this.db) await this.init();
    
    // Clear existing expenses for this trip first
    const existingExpenses = await this.db!.getAllFromIndex('expenses', 'by-trip', tripId);
    for (const expense of existingExpenses) {
      await this.db!.delete('expenses', expense._id);
    }
    
    // Add new expenses
    const now = Date.now();
    for (const expense of expenses) {
      await this.db!.put('expenses', { ...expense, tripId, lastSync: now });
    }
  }

  async batchUpdateSettlements(tripId: string, settlements: Settlement[]): Promise<void> {
    if (!this.db) await this.init();
    
    // Clear existing settlements for this trip first
    const existingSettlements = await this.db!.getAllFromIndex('settlements', 'by-trip', tripId);
    for (const settlement of existingSettlements) {
      await this.db!.delete('settlements', settlement._id);
    }
    
    // Add new settlements
    const now = Date.now();
    for (const settlement of settlements) {
      await this.db!.put('settlements', { ...settlement, lastSync: now });
    }
  }

  // Cache validation and integrity checks
  async validateCache(): Promise<{ isValid: boolean; issues: string[] }> {
    if (!this.db) await this.init();
    
    const issues: string[] = [];
    let isValid = true;

    try {
      // Check for orphaned data
      const trips = await this.db!.getAll('trips');
      const tripIds = new Set(trips.map(t => t._id));

      // Check for orphaned events
      const events = await this.db!.getAll('events');
      const orphanedEvents = events.filter(e => !tripIds.has(e.tripId));
      if (orphanedEvents.length > 0) {
        issues.push(`Found ${orphanedEvents.length} orphaned events`);
      }

      // Check for orphaned expenses
      const expenses = await this.db!.getAll('expenses');
      const orphanedExpenses = expenses.filter(e => !tripIds.has(e.tripId));
      if (orphanedExpenses.length > 0) {
        issues.push(`Found ${orphanedExpenses.length} orphaned expenses`);
      }

      // Check for orphaned settlements
      const settlements = await this.db!.getAll('settlements');
      const orphanedSettlements = settlements.filter(s => !tripIds.has(s.tripId));
      if (orphanedSettlements.length > 0) {
        issues.push(`Found ${orphanedSettlements.length} orphaned settlements`);
      }

    } catch (error) {
      issues.push(`Cache validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isValid = false;
    }

    return { isValid, issues };
  }

  // Cleanup orphaned data
  async cleanupOrphanedData(): Promise<number> {
    if (!this.db) await this.init();
    
    let cleanedCount = 0;
    const trips = await this.db!.getAll('trips');
    const tripIds = new Set(trips.map(t => t._id));

    // Clean orphaned events
    const events = await this.db!.getAll('events');
    const orphanedEvents = events.filter(e => !tripIds.has(e.tripId));
    for (const event of orphanedEvents) {
      await this.db!.delete('events', event.id);
      cleanedCount++;
    }

    // Clean orphaned expenses
    const expenses = await this.db!.getAll('expenses');
    const orphanedExpenses = expenses.filter(e => !tripIds.has(e.tripId));
    for (const expense of orphanedExpenses) {
      await this.db!.delete('expenses', expense._id);
      cleanedCount++;
    }

    // Clean orphaned settlements
    const settlements = await this.db!.getAll('settlements');
    const orphanedSettlements = settlements.filter(s => !tripIds.has(s.tripId));
    for (const settlement of orphanedSettlements) {
      await this.db!.delete('settlements', settlement._id);
      cleanedCount++;
    }

    // Clean orphaned notes
    const notes = await this.db!.getAll('notes');
    const orphanedNotes = notes.filter(n => !tripIds.has(n.tripId));
    for (const note of orphanedNotes) {
      await this.db!.delete('notes', note.tripId);
      cleanedCount++;
    }

    // Clean orphaned checklists
    const checklists = await this.db!.getAll('checklists');
    const orphanedChecklists = checklists.filter(c => !tripIds.has(c.tripId));
    for (const checklist of orphanedChecklists) {
      await this.db!.delete('checklists', checklist.key);
      cleanedCount++;
    }

    console.log(`Cleaned up ${cleanedCount} orphaned records`);
    return cleanedCount;
  }

  // Get comprehensive cache statistics
  async getCacheStats(): Promise<{
    totalRecords: number;
    byStore: Record<string, number>;
    storageUsed: number;
    storageQuota: number;
    lastSyncTimes: Record<string, number>;
    pendingSyncOps: number;
  }> {
    if (!this.db) await this.init();

    const byStore: Record<string, number> = {};
    let totalRecords = 0;
    const lastSyncTimes: Record<string, number> = {};

    // Get trips data
    const trips = await this.db!.getAll('trips');
    byStore.trips = trips.length;
    totalRecords += trips.length;
    if (trips.length > 0) {
      lastSyncTimes.trips = Math.max(...trips.map(r => r.lastSync || 0));
    }

    // Get events data
    const events = await this.db!.getAll('events');
    byStore.events = events.length;
    totalRecords += events.length;
    if (events.length > 0) {
      lastSyncTimes.events = Math.max(...events.map(r => r.lastSync || 0));
    }

    // Get expenses data
    const expenses = await this.db!.getAll('expenses');
    byStore.expenses = expenses.length;
    totalRecords += expenses.length;
    if (expenses.length > 0) {
      lastSyncTimes.expenses = Math.max(...expenses.map(r => r.lastSync || 0));
    }

    // Get settlements data
    const settlements = await this.db!.getAll('settlements');
    byStore.settlements = settlements.length;
    totalRecords += settlements.length;
    if (settlements.length > 0) {
      lastSyncTimes.settlements = Math.max(...settlements.map(r => r.lastSync || 0));
    }

    const syncQueue = await this.db!.getAll('syncQueue');
    const pendingSyncOps = syncQueue.length;

    const storage = await this.getStorageSize();

    return {
      totalRecords,
      byStore,
      storageUsed: storage.used,
      storageQuota: storage.quota,
      lastSyncTimes,
      pendingSyncOps
    };
  }

  // Optimize database performance
  async optimizeDatabase(): Promise<void> {
    console.log('Starting database optimization...');
    
    // Clean expired cache
    await this.clearExpiredCache();
    
    // Clean orphaned data
    const cleanedCount = await this.cleanupOrphanedData();
    
    // Validate cache integrity
    const validation = await this.validateCache();
    if (!validation.isValid) {
      console.warn('Cache validation issues found:', validation.issues);
    }
    
    console.log(`Database optimization complete. Cleaned ${cleanedCount} records.`);
  }
}

export const offlineService = new OfflineService(); 