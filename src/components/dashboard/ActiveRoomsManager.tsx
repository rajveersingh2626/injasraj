'use client';

import React, { useState, useEffect } from 'react';
import {
  Link2,
  Copy,
  Check,
  Video,
  Trash2,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { ManagedRoom } from '@/lib/classroom/room-manager';

export interface ActiveRoomsManagerProps {
  rooms: ManagedRoom[];
  onDeleteRoom: (roomId: string) => void;
  onJoinAsTeacher: (roomId: string) => void;
  className?: string;
}

export const ActiveRoomsManager: React.FC<ActiveRoomsManagerProps> = ({
  rooms,
  onDeleteRoom,
  onJoinAsTeacher,
  className = '',
}) => {
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCopyStudentLink = async (roomId: string) => {
    const studentUrl = origin ? `${origin}/classroom/${roomId}` : `/classroom/${roomId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(studentUrl);
      }
      setCopiedRoomId(roomId);
      setTimeout(() => setCopiedRoomId(null), 2500);
    } catch {
      setCopiedRoomId(roomId);
      setTimeout(() => setCopiedRoomId(null), 2500);
    }
  };

  const formatRemainingTime = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - now;
    if (diffMs <= 0) return 'Expiring...';
    const totalSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s remaining`;
  };

  return (
    <div
      data-testid="active-rooms-manager"
      className={`space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-base font-semibold text-stone-100">
            Active Class Links & Rooms
          </h2>
          <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-stone-800 text-stone-300 border border-stone-700/60">
            {rooms.length} active
          </span>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="p-8 rounded-2xl bg-stone-900/60 border border-stone-800 text-center text-stone-400 space-y-2">
          <Link2 className="w-8 h-8 mx-auto text-stone-500 opacity-60" />
          <p className="text-sm font-medium">No active class links currently</p>
          <p className="text-xs text-stone-500">
            Generate an instant room or schedule a lesson above to create shareable student links.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {rooms.map((room) => {
            const isCopied = copiedRoomId === room.roomId;
            const remaining = formatRemainingTime(room.expiresAt);

            return (
              <div
                key={room.id}
                data-testid={`active-room-card-${room.roomId}`}
                className="p-4 rounded-xl bg-stone-900/90 border border-stone-800/90 hover:border-stone-700 transition-all flex flex-col justify-between space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md uppercase tracking-wider ${
                          room.type === 'instant'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {room.type}
                      </span>
                      <span className="text-xs font-mono text-stone-400 font-medium">
                        {room.roomId}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-stone-100 line-clamp-1">
                      {room.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteRoom(room.roomId)}
                    data-testid={`delete-room-${room.roomId}`}
                    aria-label={`Delete room ${room.roomId}`}
                    title="Delete / Revoke Room"
                    className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {room.type === 'instant' && room.expiresAt && (
                  <div className="flex items-center space-x-1.5 text-xs text-amber-400/90 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/15">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono">{remaining}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyStudentLink(room.roomId)}
                    aria-label="Copy student link"
                    data-testid={`copy-student-link-${room.roomId}`}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 border border-stone-700/60 transition-all cursor-pointer active:scale-95"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Student Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-400" />
                        <span>Copy Student Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onJoinAsTeacher(room.roomId)}
                    data-testid={`join-teacher-${room.roomId}`}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-stone-950 transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join as Teacher</span>
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
