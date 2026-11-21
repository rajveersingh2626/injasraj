import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, FileText } from 'lucide-react';
import { WhiteboardPage } from '../../types/whiteboard';

export interface BrowserTabBarProps {
  pages: WhiteboardPage[];
  activePageId: string;
  onSelectTab: (pageId: string) => void;
  onAddTab: () => void;
  onCloseTab?: (pageId: string) => void;
  onRenameTab?: (pageId: string, newTitle: string) => void;
  isTeacher?: boolean;
}

export const BrowserTabBar: React.FC<BrowserTabBarProps> = ({
  pages,
  activePageId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  isTeacher = true,
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleStartRename = (e: React.MouseEvent, page: WhiteboardPage) => {
    e.stopPropagation();
    if (!isTeacher && !onRenameTab) return;
    setEditingTabId(page.id);
    setEditTitle(page.title);
  };

  const handleCommitRename = (pageId: string) => {
    if (editingTabId === pageId) {
      const trimmed = editTitle.trim();
      if (trimmed && onRenameTab) {
        onRenameTab(pageId, trimmed);
      }
      setEditingTabId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, pageId: string) => {
    if (e.key === 'Enter') {
      handleCommitRename(pageId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  return (
    <div
      className="flex items-center w-full px-2 pt-1 gap-1 bg-stone-900/95 border-b border-stone-800/90 select-none overflow-x-auto no-scrollbar"
      data-testid="browser-tab-bar"
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {pages.map((page, idx) => {
          const isActive = page.id === activePageId;
          const isEditing = editingTabId === page.id;

          return (
            <div
              key={page.id}
              data-testid={`tab-${page.id}`}
              onClick={() => onSelectTab(page.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition-colors duration-150 max-w-[200px] min-w-[120px] ${
                isActive
                  ? 'bg-stone-800 text-stone-100 border-t-2 border-t-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] active-tab'
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800/60 hover:text-stone-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-70 text-amber-500/80" />

              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleCommitRename(page.id)}
                  onKeyDown={(e) => handleKeyDown(e, page.id)}
                  className="bg-stone-950 text-stone-100 px-1 py-0.5 rounded text-xs border border-amber-500/50 outline-none w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => handleStartRename(e, page)}
                  className="truncate flex-1"
                  title="Double click to rename"
                >
                  {page.title || `Page ${idx + 1}`}
                </span>
              )}

              {pages.length > 1 && onCloseTab && (
                <button
                  type="button"
                  data-testid={`close-tab-${page.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(page.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-stone-700/60 text-stone-400 hover:text-stone-200 rounded p-0.5 transition-opacity duration-150 active:scale-95"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddTab}
          aria-label="New whiteboard tab"
          className="flex items-center justify-center p-1.5 text-stone-400 hover:text-amber-400 hover:bg-stone-800/80 rounded-md transition-all duration-150 active:scale-95"
          title="Add New Whiteboard Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
