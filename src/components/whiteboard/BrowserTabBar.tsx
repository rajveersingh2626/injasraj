import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, FileText, Lock, Unlock, Monitor } from 'lucide-react';
import { WhiteboardPage } from '../../types/whiteboard';

export interface BrowserTabBarProps {
  pages: WhiteboardPage[];
  activePageId: string;
  onSelectTab: (pageId: string) => void;
  onAddTab: () => void;
  onCloseTab?: (pageId: string) => void;
  onRenameTab?: (pageId: string, newTitle: string) => void;
  onToggleLockTab?: (pageId: string, locked: boolean) => void;
  isTeacher?: boolean;
}

export const BrowserTabBar: React.FC<BrowserTabBarProps> = ({
  pages,
  activePageId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onToggleLockTab,
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
    if (!isTeacher || !onRenameTab) return;
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
      className="flex items-center w-full px-2 pt-1 gap-1 bg-zinc-100/90 border-b border-zinc-200/80 select-none overflow-x-auto no-scrollbar"
      data-testid="browser-tab-bar"
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {pages.map((page, idx) => {
          const isActive = page.id === activePageId;
          const isEditing = editingTabId === page.id;
          const isScreenShare = Boolean(page.isScreenShareTab);

          return (
            <div
              key={page.id}
              data-testid={`tab-${page.id}`}
              onClick={() => {
                if (isTeacher) {
                  onSelectTab(page.id);
                }
              }}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors duration-150 max-w-[220px] min-w-[120px] ${
                isTeacher ? 'cursor-pointer' : 'cursor-default'
              } ${
                isActive
                  ? 'bg-white text-zinc-900 border-t-2 border-t-amber-500 shadow-sm active-tab font-semibold'
                  : 'bg-zinc-100/60 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800'
              }`}
            >
              {isScreenShare ? (
                <Monitor className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-600 animate-pulse' : 'text-zinc-400'}`} />
              ) : (
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-600' : 'text-zinc-400'}`} />
              )}

              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleCommitRename(page.id)}
                  onKeyDown={(e) => handleKeyDown(e, page.id)}
                  className="bg-white text-zinc-900 px-1 py-0.5 rounded text-xs border border-amber-500/50 outline-none w-full shadow-inner"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => handleStartRename(e, page)}
                  className="truncate flex-1"
                  title={isTeacher ? "Double click to rename" : page.title}
                >
                  {page.title || `Page ${idx + 1}`}
                </span>
              )}

              {/* Per-Tab Lock / Unlock Control */}
              {isTeacher ? (
                <button
                  type="button"
                  data-testid={`lock-tab-${page.id}`}
                  aria-label={page.isLocked ? `Unlock tab ${page.title || idx + 1}` : `Lock tab ${page.title || idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLockTab?.(page.id, !page.isLocked);
                  }}
                  className={`p-0.5 rounded transition-colors shrink-0 ${
                    page.isLocked
                      ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                      : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70'
                  }`}
                  title={page.isLocked ? "Tab locked for students (click to unlock)" : "Tab unlocked (click to lock for students)"}
                >
                  {page.isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  )}
                </button>
              ) : (
                page.isLocked && (
                  <span
                    data-testid={`locked-indicator-${page.id}`}
                    title="This tab is locked by the tutor"
                    className="flex items-center text-rose-500 shrink-0"
                  >
                    <Lock className="w-3 h-3 text-rose-500" />
                  </span>
                )
              )}

              {isTeacher && pages.length > 1 && onCloseTab && (
                <button
                  type="button"
                  data-testid={`close-tab-${page.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(page.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700 rounded p-0.5 transition-opacity duration-150 active:scale-95 shrink-0"
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {isTeacher && (
          <button
            type="button"
            onClick={onAddTab}
            aria-label="New whiteboard tab"
            className="flex items-center justify-center p-1.5 text-zinc-500 hover:text-amber-600 hover:bg-zinc-200/60 rounded-md transition-all duration-150 active:scale-95"
            title="Add New Whiteboard Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
