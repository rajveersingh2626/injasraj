import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  FolderOpen,
  Wrench,
  ChevronRight,
  ChevronLeft,
  X,
  Sidebar,
} from 'lucide-react';
import { WhiteboardPermissions, WhiteboardPage } from '../../types/whiteboard';
import { PeopleTab, Participant } from './tabs/PeopleTab';
import { ChatTab, ChatMessage } from './tabs/ChatTab';
import { MaterialsTab, WorksheetMaterial } from './tabs/MaterialsTab';
import { ToolsTab, GridPatternType } from './tabs/ToolsTab';

export type StudioTabType = 'people' | 'chat' | 'materials' | 'tools';

export interface StudioSidePanelProps {
  // Collapse / Expand control
  isOpen?: boolean;
  onToggleOpen?: (isOpen: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;

  // Active Tab control
  activeTab?: StudioTabType;
  defaultTab?: StudioTabType;
  onTabChange?: (tab: StudioTabType) => void;

  // People Tab Props
  participants?: Participant[];
  currentUserRole?: 'teacher' | 'student';
  permissions?: WhiteboardPermissions;
  onToggleGlobalLock?: (locked: boolean) => void;
  onToggleStudentDrawing?: (studentId: string, allowed: boolean) => void;
  onToggleLaserOnly?: (laserOnly: boolean) => void;

  // Chat Tab Props
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  currentUserId?: string;
  currentUserName?: string;

  // Materials Tab Props
  onLoadWorksheet?: (fileOrUrl: File | string) => void;
  worksheets?: WorksheetMaterial[];
  isLoadingMaterials?: boolean;
  pastClasses?: any[];
  onRestoreWhiteboard?: (pastClass: any) => void;

  // Tools Tab Props
  currentGrid?: GridPatternType;
  onChangeGrid?: (grid: GridPatternType) => void;
  pages?: WhiteboardPage[];
  currentPageId?: string;
  onSelectPage?: (pageId: string) => void;
  onClonePage?: (pageId: string) => void;
  onDeletePage?: (pageId: string) => void;
  onAddPage?: () => void;
  onExportPdf?: () => void;
  onExportImage?: () => void;

  className?: string;
}

export const StudioSidePanel: React.FC<StudioSidePanelProps> = ({
  isOpen,
  onToggleOpen,
  isCollapsed,
  onToggleCollapse,
  activeTab: controlledTab,
  defaultTab = 'people',
  onTabChange,
  // People props
  participants = [],
  currentUserRole = 'student',
  permissions,
  onToggleGlobalLock,
  onToggleStudentDrawing,
  onToggleLaserOnly,
  // Chat props
  messages = [],
  onSendMessage,
  currentUserId,
  currentUserName,
  // Materials props
  onLoadWorksheet = () => {},
  worksheets,
  isLoadingMaterials,
  pastClasses,
  onRestoreWhiteboard,
  // Tools props
  currentGrid = 'blank',
  onChangeGrid,
  pages = [],
  currentPageId,
  onSelectPage,
  onClonePage,
  onDeletePage,
  onAddPage,
  onExportPdf,
  onExportImage,
  className = '',
}) => {
  // Collapse state management (controlled vs uncontrolled)
  const isControlledCollapsed = isCollapsed !== undefined;
  const isControlledOpen = isOpen !== undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const effectiveCollapsed = isControlledCollapsed
    ? isCollapsed
    : isControlledOpen
    ? !isOpen
    : internalCollapsed;

  // Tab state management (controlled vs uncontrolled)
  const isControlledTab = controlledTab !== undefined;
  const [internalTab, setInternalTab] = useState<StudioTabType>(defaultTab);
  const currentActiveTab = isControlledTab ? controlledTab : internalTab;

  const handleSelectTab = (tab: StudioTabType) => {
    if (!isControlledTab) {
      setInternalTab(tab);
    }
    onTabChange?.(tab);
  };

  const handleCollapseToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
    if (onToggleOpen) {
      onToggleOpen(effectiveCollapsed); // if collapsed, opening becomes true
    }
    if (!isControlledCollapsed && !isControlledOpen) {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  // Mobile swipe-to-dismiss logic
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Rightward swipe of > 60px triggers collapse on mobile
    if (deltaX > 60 && Math.abs(deltaY) < 100) {
      handleCollapseToggle();
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const tabs: { id: StudioTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'materials', label: 'Materials', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Floating Expand Trigger when Collapsed */}
      {effectiveCollapsed && (
        <button
          type="button"
          data-testid="expand-panel-btn"
          aria-label="Expand side panel"
          title="Open Studio Side Panel"
          onClick={handleCollapseToggle}
          className="fixed top-20 right-3 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-700 bg-stone-900/95 backdrop-blur-[16px] text-stone-200 hover:text-stone-100 hover:bg-stone-800 shadow-xl transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold">Studio</span>
        </button>
      )}

      {/* Main Studio Side Panel Container */}
      <aside
        data-testid="studio-side-panel"
        data-collapsed={effectiveCollapsed}
        aria-label="Whiteboard Studio Side Panel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          boxShadow: effectiveCollapsed
            ? 'none'
            : '-8px 0 32px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        }}
        className={`fixed top-14 right-0 z-30 h-[calc(100dvh-3.5rem)] w-[320px] max-w-full flex flex-col bg-[#141210] border-l border-stone-800 text-stone-100 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          effectiveCollapsed
            ? 'translate-x-full pointer-events-none'
            : 'translate-x-0'
        } ${className}`}
      >
        {/* Panel Header */}
        <div
          data-testid="side-panel-header"
          className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-[#1c1917]"
        >
          <div className="flex items-center gap-2">
            <Sidebar className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold tracking-tight text-stone-100">
              Studio Panel
            </h2>
          </div>

          <button
            type="button"
            data-testid="collapse-panel-btn"
            aria-label="Collapse side panel"
            title="Collapse side panel"
            onClick={handleCollapseToggle}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar (People, Chat, Materials, Tools) */}
        <nav
          data-testid="panel-tab-bar"
          aria-label="Studio Panel Tabs"
          className="grid grid-cols-4 gap-1 p-2 border-b border-stone-800 bg-stone-950/60 select-none"
        >
          {tabs.map((tab) => {
            const isActive = currentActiveTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`tab-${tab.id}`}
                aria-selected={isActive}
                role="tab"
                aria-label={`${tab.label} tab`}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-medium transition-all duration-150 cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-stone-800 text-amber-400 border border-stone-700/80 shadow-sm font-semibold'
                    : 'text-stone-300 hover:text-stone-100 hover:bg-stone-900 border border-transparent'
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Content Container (State Preserved) */}
        <div data-testid="panel-tab-content" className="flex-1 overflow-hidden relative">
          <div
            style={{ display: currentActiveTab === 'people' ? 'block' : 'none' }}
            className="h-full"
          >
            <PeopleTab
              participants={participants}
              currentUserRole={currentUserRole}
              permissions={permissions}
              onToggleGlobalLock={onToggleGlobalLock}
              onToggleStudentDrawing={onToggleStudentDrawing}
              onToggleLaserOnly={onToggleLaserOnly}
            />
          </div>

          <div
            style={{ display: currentActiveTab === 'chat' ? 'block' : 'none' }}
            className="h-full"
          >
            <ChatTab
              messages={messages}
              onSendMessage={onSendMessage}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
            />
          </div>

          <div
            style={{ display: currentActiveTab === 'materials' ? 'block' : 'none' }}
            className="h-full"
          >
            <MaterialsTab
              worksheets={worksheets}
              onLoadWorksheet={onLoadWorksheet}
              isLoading={isLoadingMaterials}
              pastClasses={pastClasses}
              onRestoreWhiteboard={onRestoreWhiteboard}
              isTeacher={currentUserRole === 'teacher'}
            />
          </div>

          <div
            style={{ display: currentActiveTab === 'tools' ? 'block' : 'none' }}
            className="h-full"
          >
            <ToolsTab
              currentGrid={currentGrid}
              onChangeGrid={onChangeGrid}
              pages={pages}
              currentPageId={currentPageId}
              onSelectPage={onSelectPage}
              onClonePage={onClonePage}
              onDeletePage={onDeletePage}
              onAddPage={onAddPage}
              onExportPdf={onExportPdf}
              onExportImage={onExportImage}
            />
          </div>
        </div>
      </aside>
    </>
  );
};

export default StudioSidePanel;
