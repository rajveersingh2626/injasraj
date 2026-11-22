'use client';

import React from 'react';
import {
  History,
  Presentation,
  Trash2,
  Clock,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PastClassRecord } from '@/lib/classroom/past-classes';
import { formatDuration } from '@/components/classroom/EndClassSummaryModal';

export interface PastClassesManagerProps {
  pastClasses: PastClassRecord[];
  onDeletePastClass: (id: string) => void;
  onLaunchWithWhiteboard: (pastClass: PastClassRecord) => void;
  className?: string;
}

export const PastClassesManager: React.FC<PastClassesManagerProps> = ({
  pastClasses,
  onDeletePastClass,
  onLaunchWithWhiteboard,
  className = '',
}) => {
  return (
    <div
      data-testid="past-classes-manager"
      className={`space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-amber-400" />
          <h2 className="text-base font-semibold text-stone-100">
            Past Classes & Whiteboard Archive
          </h2>
          <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-stone-800 text-stone-300 border border-stone-700/60">
            {pastClasses.length} archived
          </span>
        </div>
      </div>

      {pastClasses.length === 0 ? (
        <div className="p-8 rounded-2xl bg-stone-900/60 border border-stone-800 text-center text-stone-400 space-y-2">
          <Presentation className="w-8 h-8 mx-auto text-stone-500 opacity-60" />
          <p className="text-sm font-medium">No past classes recorded yet</p>
          <p className="text-xs text-stone-500">
            Completed or expired lessons will appear here with full whiteboard drawings and history.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {pastClasses.map((item) => {
            const formattedDate = new Date(item.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.id}
                data-testid={`past-class-card-${item.roomId}`}
                className="p-4 rounded-xl bg-stone-900/90 border border-stone-800/90 hover:border-stone-700 transition-all flex flex-col justify-between space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-stone-400 font-medium">
                      {item.roomId}
                    </span>
                    <h3 className="text-sm font-semibold text-stone-100 line-clamp-1">
                      {item.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeletePastClass(item.id)}
                    data-testid={`delete-past-${item.id}`}
                    aria-label={`Delete record for ${item.title}`}
                    title="Delete Record"
                    className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    <span>{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-stone-500" />
                    <span>{formatDuration(item.durationSeconds || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-500/80" />
                    <span>{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => onLaunchWithWhiteboard(item)}
                    data-testid={`launch-with-wb-${item.roomId}`}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all cursor-pointer active:scale-95 shadow-sm"
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    <span>Launch with Whiteboard</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
