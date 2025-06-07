# Offline Integration Example

## How to Use the New Offline Hook

The new `useOfflineTripDetails` hook provides a drop-in replacement for existing trip detail functionality with offline-first capabilities.

### 1. Replace Existing Trip Details Hook

**Before (src/components/TripDetails/hooks.ts):**
```typescript
export const useTripDetails = () => {
  // ... existing implementation
  const fetchTrip = useCallback(async () => {
    const tripData = await api.getTrip(id);
    setTrip(tripData);
  }, [id]);
  
  return { trip, loading, addEvent, updateEvent, deleteEvent };
};
```

**After (using offline hook):**
```typescript
import { useOfflineTripDetails } from '../../hooks/useOfflineTripDetails';

export const useTripDetails = () => {
  // Simply use the offline-aware hook
  return useOfflineTripDetails();
};
```

### 2. Enhanced TripNotes Component

**Before:**
```typescript
const TripNotes: React.FC<TripNotesProps> = ({ tripId, canEdit }) => {
  const [note, setNote] = useState<TripNote | null>(null);
  
  const fetchNotes = async () => {
    const notes = await api.getTripNotes(tripId);
    setNote(notes);
  };
  
  const updateNotes = async (content: string) => {
    const updated = await api.updateTripNotes(tripId, content);
    setNote(updated);
  };
  
  // ... rest of component
};
```

**After (with offline support):**
```typescript
import { useOfflineTripDetails } from '../hooks/useOfflineTripDetails';

const TripNotes: React.FC<TripNotesProps> = ({ tripId, canEdit }) => {
  const { notes, loadingNotes, updateNotes, isOnline, hasPendingSync } = useOfflineTripDetails();
  
  // Show offline indicator in the component
  const OfflineNotice = () => (
    !isOnline && (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-4">
        <p className="text-sm text-yellow-800">
          📝 Editing offline - changes will sync when you reconnect
          {hasPendingSync && " (pending sync)"}
        </p>
      </div>
    )
  );
  
  return (
    <div>
      <OfflineNotice />
      {/* Your existing editor component */}
      <EditorComponent 
        content={notes?.content || ''}
        onUpdate={(content) => updateNotes(content)}
        loading={loadingNotes}
      />
    </div>
  );
};
```

### 3. Enhanced TripChecklist Component

**Before:**
```typescript
const TripChecklist: React.FC<TripChecklistProps> = ({ tripId, canEdit }) => {
  const [bins, setBins] = useState<ChecklistBin[]>([]);
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  
  const fetchBins = async () => {
    const data = await fetch(`/api/trips/${tripId}/checklist/${activeTab}`);
    setBins(await data.json());
  };
  
  const syncBins = async (newBins: ChecklistBin[]) => {
    await fetch(`/api/trips/${tripId}/checklist/${activeTab}`, {
      method: 'POST',
      body: JSON.stringify({ bins: newBins })
    });
    setBins(newBins);
  };
};
```

**After (with offline support):**
```typescript
import { useOfflineTripDetails } from '../hooks/useOfflineTripDetails';

const TripChecklist: React.FC<TripChecklistProps> = ({ tripId, canEdit }) => {
  const { 
    sharedChecklist, 
    personalChecklist, 
    updateSharedChecklist, 
    updatePersonalChecklist,
    loadingChecklist,
    isOnline,
    hasPendingSync 
  } = useOfflineTripDetails();
  
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  
  const currentBins = activeTab === 'shared' ? sharedChecklist : personalChecklist;
  const updateBins = activeTab === 'shared' ? updateSharedChecklist : updatePersonalChecklist;
  
  return (
    <div>
      {/* Offline status indicator */}
      {(!isOnline || hasPendingSync) && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-4">
          <p className="text-sm text-blue-800">
            {!isOnline ? "📋 Working offline" : "🔄 Syncing changes..."}
          </p>
        </div>
      )}
      
      {/* Tab switcher */}
      <div className="flex space-x-2 mb-4">
        <button 
          onClick={() => setActiveTab('shared')}
          className={activeTab === 'shared' ? 'active' : ''}
        >
          Shared ({sharedChecklist.length})
        </button>
        <button 
          onClick={() => setActiveTab('personal')}
          className={activeTab === 'personal' ? 'active' : ''}
        >
          Personal ({personalChecklist.length})
        </button>
      </div>
      
      {/* Checklist content */}
      <ChecklistContent 
        bins={currentBins}
        onUpdate={updateBins}
        loading={loadingChecklist}
        canEdit={canEdit}
      />
    </div>
  );
};
```

### 4. Event Management with Offline Support

**Creating Events Offline:**
```typescript
const EventForm: React.FC = () => {
  const { createEvent, isOnline, hasPendingSync } = useOfflineTripDetails();
  
  const handleSubmit = async (eventData: EventFormData) => {
    try {
      await createEvent(eventData);
      
      // Show success message with offline context
      showMessage(
        isOnline 
          ? "Event created and synced!"
          : "Event created offline - will sync when connected"
      );
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Offline indicator in form */}
      {!isOnline && (
        <div className="bg-yellow-50 p-3 rounded-md mb-4">
          <p className="text-sm text-yellow-800">
            ✈️ Creating event offline - it will be saved and synced automatically
          </p>
        </div>
      )}
      
      {/* Form fields */}
      <FormFields />
      
      <button type="submit" disabled={false}>
        {isOnline ? 'Create Event' : 'Create Event (Offline)'}
      </button>
    </form>
  );
};
```

### 5. Adding Offline State to Existing Components

For any component that needs offline awareness, you can add:

```typescript
import { networkAwareApi } from '../services/networkAwareApi';

const YourComponent: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  
  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    const checkSync = async () => {
      const pending = await networkAwareApi.hasPendingSync();
      setHasPendingSync(pending);
    };
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    const interval = setInterval(checkSync, 10000);
    
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);
  
  return (
    <div>
      {/* Your component with offline awareness */}
      {!isOnline && <OfflineBanner />}
      {hasPendingSync && <SyncPendingIndicator />}
      {/* Rest of component */}
    </div>
  );
};
```

## Key Benefits

### For Users
1. **Seamless Experience**: App works the same online or offline
2. **No Data Loss**: All changes are saved locally and synced automatically
3. **Visual Feedback**: Clear indicators of offline status and sync progress
4. **Optimistic Updates**: UI responds immediately to user actions

### For Developers
1. **Drop-in Replacement**: Minimal changes to existing components
2. **Consistent API**: Same interface for online and offline operations
3. **Automatic Sync**: No manual sync management required
4. **Comprehensive**: Covers trips, events, expenses, notes, and checklists

## Migration Checklist

- [ ] Replace existing hooks with `useOfflineTripDetails`
- [ ] Add offline indicators to components
- [ ] Update form submission handling for offline context
- [ ] Test offline scenarios thoroughly
- [ ] Update user documentation

## Next Steps

1. **Gradual Migration**: Start with one component and gradually adopt across the app
2. **User Testing**: Test with real users in offline scenarios
3. **Performance Monitoring**: Monitor sync performance and storage usage
4. **Feature Enhancement**: Add advanced features like conflict resolution UI

---

*This offline implementation provides a robust foundation for offline-first functionality while maintaining compatibility with existing code.* 