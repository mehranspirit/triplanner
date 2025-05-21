import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Trash2, Loader2, RefreshCw, AlertCircle, X } from 'lucide-react';
import { io } from 'socket.io-client';
import debounce from 'lodash/debounce';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  isEditing?: boolean;
}

interface ChecklistBin {
  id: string;
  title: string;
  items: ChecklistItem[];
}

type Checklist = ChecklistBin[];

interface TripChecklistProps {
  tripId: string;
  canEdit: boolean;
}

const initialBins: Checklist = [
  { id: crypto.randomUUID(), title: 'To Do', items: [] },
];

// Cache structure with metadata
interface CacheEntry {
  data: Checklist;
  timestamp: number;
  version: number;
}

interface ChecklistCache {
  [tripId: string]: {
    [tab: string]: CacheEntry;
  };
}

// Module-level cache with metadata
const checklistCache: ChecklistCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 1;

const TripChecklist: React.FC<TripChecklistProps> = ({ tripId, canEdit }) => {
  const [bins, setBins] = useState<Checklist>(initialBins);
  const [input, setInput] = useState('');
  const [newBinTitle, setNewBinTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine endpoint based on tab
  const endpoint = activeTab === 'shared' ? 'shared' : 'personal';

  // Check if cache is valid
  const isCacheValid = useCallback((entry: CacheEntry | undefined) => {
    if (!entry) return false;
    const now = Date.now();
    return (
      now - entry.timestamp < CACHE_DURATION &&
      entry.version === CACHE_VERSION
    );
  }, []);

  // Clear cache for current trip/tab
  const clearCache = useCallback(() => {
    if (checklistCache[tripId]) {
      delete checklistCache[tripId][endpoint];
    }
  }, [tripId, endpoint]);

  // Fetch bins from backend
  const fetchBins = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh && checklistCache[tripId]?.[endpoint] && isCacheValid(checklistCache[tripId][endpoint])) {
        setBins(checklistCache[tripId][endpoint].data);
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/checklist/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch checklist: ${response.statusText}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setBins(data);
        // Update cache
        if (!checklistCache[tripId]) {
          checklistCache[tripId] = {};
        }
        checklistCache[tripId][endpoint] = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      }
    } catch (error) {
      console.error('Error fetching checklist:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch checklist');
      // If we have stale cache data, use it
      if (checklistCache[tripId]?.[endpoint]) {
        setBins(checklistCache[tripId][endpoint].data);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, endpoint, isCacheValid]);

  // Debounced sync function
  const debouncedSync = useCallback(
    debounce(async (nextBins: Checklist) => {
      setIsSyncing(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/checklist/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bins: nextBins }),
        });

        if (!response.ok) {
          throw new Error(`Failed to sync checklist: ${response.statusText}`);
        }

        // Update cache on successful sync
        if (!checklistCache[tripId]) {
          checklistCache[tripId] = {};
        }
        checklistCache[tripId][endpoint] = {
          data: nextBins,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      } catch (error) {
        console.error('Error syncing checklist:', error);
        setError(error instanceof Error ? error.message : 'Failed to sync checklist');
        // Refresh data on sync error
        fetchBins(true);
      } finally {
        setIsSyncing(false);
      }
    }, 1000),
    [tripId, endpoint]
  );

  // Sync bins to backend
  const syncBins = useCallback((nextBins: Checklist) => {
    setBins(nextBins);
    debouncedSync(nextBins);
  }, [debouncedSync]);

  // Fetch on mount and tab change
  useEffect(() => {
    fetchBins();
  }, [tripId, endpoint, fetchBins]);

  // Socket.io setup
  useEffect(() => {
    const socket = io();
    socket.on('checklistUpdate', (data) => {
      if (data.tripId === tripId) {
        // Refresh data when receiving updates
        fetchBins(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tripId, fetchBins]);

  // Add a new bin
  const handleAddBin = () => {
    if (!newBinTitle.trim()) return;
    const nextBins = [...bins, { id: crypto.randomUUID(), title: newBinTitle.trim(), items: [] }];
    setNewBinTitle('');
    syncBins(nextBins);
  };

  // Add a new item to a bin
  const handleAddItem = (binId: string) => {
    if (!input.trim()) return;
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? { ...bin, items: [...bin.items, { id: crypto.randomUUID(), text: input.trim(), completed: false }] }
        : bin
    );
    setInput('');
    syncBins(nextBins);
  };

  // Toggle item completed
  const handleToggle = (binId: string, itemId: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? { ...bin, items: bin.items.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item) }
        : bin
    );
    syncBins(nextBins);
  };

  // Delete item
  const handleDeleteItem = (binId: string, itemId: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? { ...bin, items: bin.items.filter(item => item.id !== itemId) }
        : bin
    );
    syncBins(nextBins);
  };

  // Edit bin title
  const handleEditBinTitle = (binId: string, newTitle: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId ? { ...bin, title: newTitle } : bin
    );
    syncBins(nextBins);
  };

  // Delete bin
  const handleDeleteBin = (binId: string) => {
    const nextBins = bins.filter(bin => bin.id !== binId);
    syncBins(nextBins);
  };

  // Handle item edit
  const handleEditItem = (binId: string, itemId: string, newText: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? {
            ...bin,
            items: bin.items.map(item =>
              item.id === itemId
                ? { ...item, text: newText, isEditing: false }
                : item
            )
          }
        : bin
    );
    syncBins(nextBins);
  };

  // Toggle item edit mode
  const toggleItemEdit = (binId: string, itemId: string) => {
    if (!canEdit) return;
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? {
            ...bin,
            items: bin.items.map(item =>
              item.id === itemId
                ? { ...item, isEditing: !item.isEditing }
                : { ...item, isEditing: false }
            )
          }
        : bin
    );
    setBins(nextBins);
  };

  // Handle item click
  const handleItemClick = (binId: string, itemId: string) => {
    if (!canEdit) return;
    toggleItemEdit(binId, itemId);
  };

  // Drag and drop logic
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    let nextBins = bins;
    if (source.droppableId === destination.droppableId) {
      // Reorder within the same bin
      nextBins = bins.map(bin => {
        if (bin.id !== source.droppableId) return bin;
        const newItems = Array.from(bin.items);
        const [moved] = newItems.splice(source.index, 1);
        newItems.splice(destination.index, 0, moved);
        return { ...bin, items: newItems };
      });
    } else {
      // Move item across bins
      nextBins = bins.map(bin => {
        if (bin.id === source.droppableId) {
          const newItems = Array.from(bin.items);
          newItems.splice(source.index, 1);
          return { ...bin, items: newItems };
        }
        if (bin.id === destination.droppableId) {
          const sourceBin = bins.find(b => b.id === source.droppableId);
          if (!sourceBin) return bin;
          const moved = sourceBin.items[source.index];
          const newItems = Array.from(bin.items);
          newItems.splice(destination.index, 0, moved);
          return { ...bin, items: newItems };
        }
        return bin;
      });
    }
    syncBins(nextBins);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
        <span className="ml-2 text-gray-400">Loading checklist...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white z-50">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={cn('flex-1 py-2 text-center', activeTab === 'shared' ? 'font-bold border-b-2 border-green-500' : 'text-gray-500')}
          onClick={() => setActiveTab('shared')}
        >
          Shared
        </button>
        <button
          className={cn('flex-1 py-2 text-center', activeTab === 'personal' ? 'font-bold border-b-2 border-green-500' : 'text-gray-500')}
          onClick={() => setActiveTab('personal')}
        >
          Personal
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchBins(true)}
            className="ml-auto"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Sync indicator */}
      {isSyncing && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-600">
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="text-sm">Syncing changes...</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-4 border-b">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={newBinTitle}
          onChange={e => setNewBinTitle(e.target.value)}
          placeholder="Add new bin..."
        />
        <Button onClick={handleAddBin} disabled={!newBinTitle.trim()}>
          Add Bin
        </Button>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col flex-1 overflow-y-auto gap-4 p-4">
          {bins.map(bin => (
            <div key={bin.id} className="flex flex-col bg-gray-50 rounded-lg shadow-md w-full min-w-0">
              <div className="flex items-center gap-2 p-3 border-b">
                <input
                  className="flex-1 font-bold text-lg bg-transparent border-none outline-none"
                  value={bin.title}
                  onChange={e => handleEditBinTitle(bin.id, e.target.value)}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBin(bin.id)}
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Droppable droppableId={bin.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 p-3 space-y-2 min-h-[60px]"
                  >
                    {bin.items.length === 0 && <div className="text-gray-400 text-center">No items</div>}
                    {bin.items.map((item, idx) => (
                      <Draggable key={item.id} draggableId={item.id} index={idx}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="flex items-center gap-2 bg-white rounded shadow p-2"
                          >
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleToggle(bin.id, item.id)}
                              className="accent-green-500"
                            />
                            {item.isEditing ? (
                              <Input
                                value={item.text}
                                onChange={(e) => {
                                  const nextBins = bins.map(b =>
                                    b.id === bin.id
                                      ? {
                                          ...b,
                                          items: b.items.map(i =>
                                            i.id === item.id
                                              ? { ...i, text: e.target.value }
                                              : i
                                          )
                                        }
                                      : b
                                  );
                                  setBins(nextBins);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleEditItem(bin.id, item.id, item.text);
                                  } else if (e.key === 'Escape') {
                                    toggleItemEdit(bin.id, item.id);
                                  }
                                }}
                                onBlur={() => handleEditItem(bin.id, item.id, item.text)}
                                className="flex-1"
                                autoFocus
                              />
                            ) : (
                              <span
                                className={cn(
                                  'flex-1 cursor-pointer',
                                  item.completed && 'line-through text-gray-400'
                                )}
                                onClick={() => handleItemClick(bin.id, item.id)}
                              >
                                {item.text}
                              </span>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(bin.id, item.id)}
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              {canEdit && (
                <div className="flex gap-2 p-3 border-t">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem(bin.id)}
                    placeholder="Add an item..."
                  />
                  <Button onClick={() => handleAddItem(bin.id)} disabled={!input.trim()}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default TripChecklist;
