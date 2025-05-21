import React, { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { api, TripNote } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { debounce } from 'lodash';
import { UserHighlight } from '../extensions/UserHighlight';
import '../styles/TripNotes.css';

interface TripNotesProps {
  tripId: string;
  canEdit: boolean;
}

// Cache structure with metadata
interface CacheEntry {
  data: TripNote;
  timestamp: number;
  version: number;
}

interface NotesCache {
  [tripId: string]: CacheEntry;
}

// Module-level cache with metadata
const notesCache: NotesCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 1;

// Generate a pastel color based on user ID
const generateUserColor = (userId: string) => {
  // Generate a hash from the user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate pastel color
  const hue = hash % 360;
  return `hsla(${hue}, 70%, 85%, 0.5)`;
};

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 p-2 overflow-x-auto whitespace-nowrap">
      <div className="flex gap-1 min-w-max">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          h1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          h2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          h3
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <em>I</em>
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded ${editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          1. List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-2 py-1 rounded ${editor.isActive('taskList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          ☐ Tasks
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 rounded ${editor.isActive('blockquote') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          Quote
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-2 py-1 rounded hover:bg-gray-100"
        >
          Line
        </button>
      </div>
    </div>
  );
};

const TripNotes: React.FC<TripNotesProps> = ({ tripId, canEdit }) => {
  const { user } = useAuth();
  const [note, setNote] = useState<TripNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if cache is valid
  const isCacheValid = useCallback((entry: CacheEntry | undefined) => {
    if (!entry) return false;
    const now = Date.now();
    return (
      now - entry.timestamp < CACHE_DURATION &&
      entry.version === CACHE_VERSION
    );
  }, []);

  // Clear cache for current trip
  const clearCache = useCallback(() => {
    if (notesCache[tripId]) {
      delete notesCache[tripId];
    }
  }, [tripId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      UserHighlight.configure({
        user: user ? {
          _id: user._id,
          name: user.name,
          photoUrl: user.photoUrl || undefined
        } : null
      })
    ],
    content: note?.content || '',
    editable: canEdit,
    onUpdate: ({ editor, transaction }) => {
      // Only highlight text if it's a content change (not a selection change)
      if (transaction.docChanged && user) {
        editor.commands.setUserHighlight();
      }
      const content = editor.getHTML();
      debouncedUpdateNotes(content);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none'
      }
    }
  });

  // Debounced function to update notes
  const debouncedUpdateNotes = debounce(async (content: string) => {
    try {
      const updatedNote = await api.updateTripNotes(tripId, content);
      setNote(updatedNote);
      // Update cache
      notesCache[tripId] = {
        data: updatedNote,
        timestamp: Date.now(),
        version: CACHE_VERSION
      };
    } catch (err) {
      console.error('Error updating notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notes');
    }
  }, 1000);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check cache first
        if (notesCache[tripId] && isCacheValid(notesCache[tripId])) {
          setNote(notesCache[tripId].data);
          if (editor) {
            editor.commands.setContent(notesCache[tripId].data.content);
          }
          setIsLoading(false);
          return;
        }

        const tripNote = await api.getTripNotes(tripId);
        setNote(tripNote);
        if (editor) {
          editor.commands.setContent(tripNote.content);
        }
        // Update cache
        notesCache[tripId] = {
          data: tripNote,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      } catch (err) {
        console.error('Error fetching notes:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch notes');
        // If we have stale cache data, use it
        if (notesCache[tripId]) {
          setNote(notesCache[tripId].data);
          if (editor) {
            editor.commands.setContent(notesCache[tripId].data.content);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, [tripId, editor, isCacheValid]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {canEdit && editor && (
        <div className="flex-none">
          <MenuBar editor={editor} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <div className="absolute inset-0">
          <div className="h-full p-4">
            <EditorContent editor={editor} className="prose max-w-none" />
          </div>
        </div>
      </div>
      
      {note?.lastEditedBy && (
        <div className="flex-none border-t border-gray-200 p-4 flex items-center space-x-2 text-sm text-gray-500 bg-white">
          <Avatar
            photoUrl={note.lastEditedBy.photoUrl}
            name={note.lastEditedBy.name}
            size="sm"
          />
          <span>
            Last edited by {note.lastEditedBy.name} on{' '}
            {new Date(note.lastEditedAt).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default TripNotes; 