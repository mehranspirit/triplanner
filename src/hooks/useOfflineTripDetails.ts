import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Trip, Event } from '../types/eventTypes';
import { Expense } from '../types/expenseTypes';
import { networkAwareApi } from '../services/networkAwareApi';
import { TripNote, ChecklistBin } from '../services/offlineService';

export interface OfflineTripDetails {
  // Trip data
  trip: Trip | null;
  loading: boolean;
  error: string | null;
  
  // Trip operations
  updateTrip: (trip: Trip) => Promise<Trip>;
  deleteTrip: () => Promise<void>;
  
  // Event operations
  createEvent: (eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>) => Promise<Event>;
  updateEvent: (event: Event) => Promise<Event>;
  deleteEvent: (eventId: string) => Promise<void>;
  
  // Expense operations
  expenses: Expense[];
  loadingExpenses: boolean;
  addExpense: (expenseData: Omit<Expense, '_id'>) => Promise<Expense>;
  
  // Notes operations
  notes: TripNote | null;
  loadingNotes: boolean;
  updateNotes: (content: string) => Promise<TripNote>;
  
  // Checklist operations
  sharedChecklist: ChecklistBin[];
  personalChecklist: ChecklistBin[];
  loadingChecklist: boolean;
  updateSharedChecklist: (bins: ChecklistBin[]) => Promise<ChecklistBin[]>;
  updatePersonalChecklist: (bins: ChecklistBin[]) => Promise<ChecklistBin[]>;
  
  // Network status
  isOnline: boolean;
  hasPendingSync: boolean;
  
  // Manual refresh
  refreshAll: () => Promise<void>;
}

export const useOfflineTripDetails = (): OfflineTripDetails => {
  const { id: tripId } = useParams<{ id: string }>();
  
  // Trip state
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  
  // Notes state
  const [notes, setNotes] = useState<TripNote | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  
  // Checklist state
  const [sharedChecklist, setSharedChecklist] = useState<ChecklistBin[]>([]);
  const [personalChecklist, setPersonalChecklist] = useState<ChecklistBin[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  
  // Network state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  // Network status monitoring
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    const checkPendingSync = async () => {
      try {
        const pending = await networkAwareApi.hasPendingSync();
        setHasPendingSync(pending);
      } catch (error) {
        console.error('Failed to check pending sync:', error);
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check pending sync periodically
    checkPendingSync();
    const syncInterval = setInterval(checkPendingSync, 10000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(syncInterval);
    };
  }, []);

  // Load trip data
  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    
    setLoading(true);
    setError(null);
    
         try {
       const tripData = await networkAwareApi.getTrip(tripId);
       setTrip(tripData || null);
     } catch (err) {
      console.error('Error loading trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  // Load expenses
  const loadExpenses = useCallback(async () => {
    if (!tripId) return;
    
    setLoadingExpenses(true);
    try {
      const expenseData = await networkAwareApi.getExpenses(tripId);
      setExpenses(expenseData);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [tripId]);

  // Load notes
  const loadNotes = useCallback(async () => {
    if (!tripId) return;
    
    setLoadingNotes(true);
    try {
      const notesData = await networkAwareApi.getNotes(tripId);
      setNotes(notesData || null);
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  }, [tripId]);

  // Load checklists
  const loadChecklists = useCallback(async () => {
    if (!tripId) return;
    
    setLoadingChecklist(true);
    try {
      const [shared, personal] = await Promise.all([
        networkAwareApi.getChecklist(tripId, 'shared'),
        networkAwareApi.getChecklist(tripId, 'personal')
      ]);
      setSharedChecklist(shared);
      setPersonalChecklist(personal);
    } catch (err) {
      console.error('Error loading checklists:', err);
    } finally {
      setLoadingChecklist(false);
    }
  }, [tripId]);

  // Load all data on mount
  useEffect(() => {
    loadTrip();
    loadExpenses();
    loadNotes();
    loadChecklists();
  }, [loadTrip, loadExpenses, loadNotes, loadChecklists]);

  // Trip operations
  const updateTrip = useCallback(async (updatedTrip: Trip): Promise<Trip> => {
    try {
      const result = await networkAwareApi.updateTrip(updatedTrip);
      setTrip(result);
      return result;
    } catch (err) {
      console.error('Error updating trip:', err);
      throw err;
    }
  }, []);

  const deleteTrip = useCallback(async (): Promise<void> => {
    if (!tripId) return;
    
    try {
      await networkAwareApi.deleteTrip(tripId);
      setTrip(null);
    } catch (err) {
      console.error('Error deleting trip:', err);
      throw err;
    }
  }, [tripId]);

  // Event operations
  const createEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>): Promise<Event> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      const newEvent = await networkAwareApi.createEvent(tripId, eventData);
      
      // Update local trip state optimistically
      if (trip) {
        const updatedTrip = { ...trip, events: [...trip.events, newEvent] };
        setTrip(updatedTrip);
      }
      
      return newEvent;
    } catch (err) {
      console.error('Error creating event:', err);
      throw err;
    }
  }, [tripId, trip]);

  const updateEvent = useCallback(async (event: Event): Promise<Event> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      const updatedEvent = await networkAwareApi.updateEvent(tripId, event);
      
      // Update local trip state optimistically
      if (trip) {
        const updatedEvents = trip.events.map(e => e.id === event.id ? updatedEvent : e);
        const updatedTrip = { ...trip, events: updatedEvents };
        setTrip(updatedTrip);
      }
      
      return updatedEvent;
    } catch (err) {
      console.error('Error updating event:', err);
      throw err;
    }
  }, [tripId, trip]);

  const deleteEvent = useCallback(async (eventId: string): Promise<void> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      await networkAwareApi.deleteEvent(tripId, eventId);
      
      // Update local trip state optimistically
      if (trip) {
        const updatedEvents = trip.events.filter(e => e.id !== eventId);
        const updatedTrip = { ...trip, events: updatedEvents };
        setTrip(updatedTrip);
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      throw err;
    }
  }, [tripId, trip]);

  // Expense operations
  const addExpense = useCallback(async (expenseData: Omit<Expense, '_id'>): Promise<Expense> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      const newExpense = await networkAwareApi.addExpense(tripId, expenseData);
      setExpenses(prev => [...prev, newExpense]);
      return newExpense;
    } catch (err) {
      console.error('Error adding expense:', err);
      throw err;
    }
  }, [tripId]);

  // Notes operations
  const updateNotes = useCallback(async (content: string): Promise<TripNote> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      const updatedNotes = await networkAwareApi.updateNotes(tripId, content);
      setNotes(updatedNotes);
      return updatedNotes;
    } catch (err) {
      console.error('Error updating notes:', err);
      throw err;
    }
  }, [tripId]);

  // Checklist operations
  const updateSharedChecklist = useCallback(async (bins: ChecklistBin[]): Promise<ChecklistBin[]> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      const updatedBins = await networkAwareApi.updateChecklist(tripId, 'shared', bins);
      setSharedChecklist(updatedBins);
      return updatedBins;
    } catch (err) {
      console.error('Error updating shared checklist:', err);
      throw err;
    }
  }, [tripId]);

  const updatePersonalChecklist = useCallback(async (bins: ChecklistBin[]): Promise<ChecklistBin[]> => {
    if (!tripId) throw new Error('No trip ID');
    
    try {
      const updatedBins = await networkAwareApi.updateChecklist(tripId, 'personal', bins);
      setPersonalChecklist(updatedBins);
      return updatedBins;
    } catch (err) {
      console.error('Error updating personal checklist:', err);
      throw err;
    }
  }, [tripId]);

  // Manual refresh
  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      loadTrip(),
      loadExpenses(),
      loadNotes(),
      loadChecklists()
    ]);
  }, [loadTrip, loadExpenses, loadNotes, loadChecklists]);

  return {
    // Trip data
    trip,
    loading,
    error,
    
    // Trip operations
    updateTrip,
    deleteTrip,
    
    // Event operations
    createEvent,
    updateEvent,
    deleteEvent,
    
    // Expense operations
    expenses,
    loadingExpenses,
    addExpense,
    
    // Notes operations
    notes,
    loadingNotes,
    updateNotes,
    
    // Checklist operations
    sharedChecklist,
    personalChecklist,
    loadingChecklist,
    updateSharedChecklist,
    updatePersonalChecklist,
    
    // Network status
    isOnline,
    hasPendingSync,
    
    // Manual refresh
    refreshAll
  };
}; 