import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Lock,
  Unlock,
  Radio,
  Shield,
  User,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import { WhiteboardPermissions, defaultWhiteboardPermissions } from '../../../types/whiteboard';
import { GlassCard } from '../../ui/GlassCard';

export interface Participant {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  isMicOn?: boolean;
  isCameraOn?: boolean;
  isDrawingAllowed?: boolean;
  avatarUrl?: string;
  isSelf?: boolean;
}

export interface PeopleTabProps {
  participants?: Participant[];
  currentUserRole?: 'teacher' | 'student';
  permissions?: WhiteboardPermissions;
  onToggleGlobalLock?: (locked: boolean) => void;
  onToggleStudentDrawing?: (studentId: string, allowed: boolean) => void;
  onToggleLaserOnly?: (laserOnly: boolean) => void;
  className?: string;
}

export const PeopleTab: React.FC<PeopleTabProps> = ({
  participants = [],
  currentUserRole = 'student',
  permissions = defaultWhiteboardPermissions(),
  onToggleGlobalLock,
  onToggleStudentDrawing,
  onToggleLaserOnly,
  className = '',
}) => {
  const isTeacher = currentUserRole === 'teacher';

  const defaultParticipants: Participant[] =
    participants.length > 0
      ? participants
      : [
          {
            id: 'teacher-default',
            name: 'Teacher (You)',
            role: 'teacher',
            isMicOn: true,
            isCameraOn: true,
            isSelf: isTeacher,
          },
          {
            id: 'student-default',
            name: 'Student 1',
            role: 'student',
            isMicOn: true,
            isCameraOn: false,
            isSelf: !isTeacher,
          },
        ];

  const activeParticipants = participants.length > 0 ? participants : defaultParticipants;

  return (
    <div
      data-testid="people-tab"
      className={`flex flex-col h-full gap-4 p-4 overflow-y-auto select-none ${className}`}
    >
      {/* Teacher-Only Controls Section */}
      {isTeacher && (
        <section
          data-testid="teacher-controls-section"
          aria-label="Teacher Whiteboard Controls"
          className="flex flex-col gap-2.5 pb-3 border-b border-white/[0.08]"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-indigo-400">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Classroom Authority</span>
          </div>

          {/* Global Lock Switch */}
          <GlassCard
            variant="subtle"
            className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08]"
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  permissions.isLockedGlobally
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {permissions.isLockedGlobally ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-100">Global Lock</div>
                <div className="text-[11px] text-zinc-400">Lock Whiteboard for All</div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={permissions.isLockedGlobally}
              data-testid="toggle-global-lock"
              aria-label="Lock Whiteboard for All"
              onClick={() => onToggleGlobalLock?.(!permissions.isLockedGlobally)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                permissions.isLockedGlobally ? 'bg-red-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  permissions.isLockedGlobally ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </GlassCard>

          {/* Laser Pointer Only Switch */}
          <GlassCard
            variant="subtle"
            className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08]"
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  permissions.laserPointerOnly
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-700/50 text-zinc-400'
                }`}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-100">Laser Pointer Only</div>
                <div className="text-[11px] text-zinc-400">Restrict students to pointer</div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={permissions.laserPointerOnly}
              data-testid="toggle-laser-only"
              aria-label="Laser Pointer Only"
              onClick={() => onToggleLaserOnly?.(!permissions.laserPointerOnly)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                permissions.laserPointerOnly ? 'bg-amber-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  permissions.laserPointerOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </GlassCard>
        </section>
      )}

      {/* Participants List */}
      <section
        data-testid="participants-section"
        aria-label="Classroom Participants"
        className="flex flex-col gap-2.5 flex-1"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 tracking-wider uppercase">
          <span>Participants ({activeParticipants.length})</span>
        </div>

        <div className="flex flex-col gap-2" data-testid="participants-list">
          {activeParticipants.map((participant) => {
            const isStudent = participant.role === 'student';
            // Drawing permission check
            const hasDrawingAccess =
              permissions.studentDrawingGranted[participant.id] !== undefined
                ? permissions.studentDrawingGranted[participant.id]
                : participant.isDrawingAllowed ?? false;

            return (
              <GlassCard
                key={participant.id}
                variant="default"
                data-testid={`participant-card-${participant.id}`}
                className="flex flex-col p-3 rounded-xl gap-2 border border-white/[0.06]"
              >
                <div className="flex items-center justify-between">
                  {/* Name & Avatar */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-semibold">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {participant.name}
                        </span>
                        {participant.isSelf && (
                          <span className="text-[10px] text-zinc-400 font-normal">(You)</span>
                        )}
                      </div>
                      <span
                        data-testid={`role-badge-${participant.id}`}
                        className={`text-[10px] font-medium tracking-wide w-fit px-1.5 py-0.5 rounded-full ${
                          participant.role === 'teacher'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-zinc-700/50 text-zinc-300 border border-zinc-600/30'
                        }`}
                      >
                        {participant.role === 'teacher' ? 'Teacher' : 'Student'}
                      </span>
                    </div>
                  </div>

                  {/* Mic / Video Status Indicators */}
                  <div
                    data-testid={`media-indicators-${participant.id}`}
                    className="flex items-center gap-1.5 flex-shrink-0 text-zinc-400"
                  >
                    <span
                      title={participant.isMicOn ? 'Microphone on' : 'Microphone muted'}
                      data-testid={`mic-status-${participant.id}`}
                      className={`p-1 rounded-md ${
                        participant.isMicOn
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-zinc-500 bg-zinc-800'
                      }`}
                    >
                      {participant.isMicOn ? (
                        <Mic className="w-3.5 h-3.5" />
                      ) : (
                        <MicOff className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span
                      title={participant.isCameraOn ? 'Camera on' : 'Camera off'}
                      data-testid={`camera-status-${participant.id}`}
                      className={`p-1 rounded-md ${
                        participant.isCameraOn
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-zinc-500 bg-zinc-800'
                      }`}
                    >
                      {participant.isCameraOn ? (
                        <Video className="w-3.5 h-3.5" />
                      ) : (
                        <VideoOff className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Per-student drawing permission toggle (Teacher only) */}
                {isTeacher && isStudent && (
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <Edit3 className="w-3 h-3 text-indigo-400" />
                      <span>Allow Drawing</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hasDrawingAccess}
                      data-testid={`toggle-drawing-${participant.id}`}
                      aria-label={`Allow drawing for ${participant.name}`}
                      onClick={() =>
                        onToggleStudentDrawing?.(participant.id, !hasDrawingAccess)
                      }
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        hasDrawingAccess ? 'bg-indigo-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          hasDrawingAccess ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default PeopleTab;
