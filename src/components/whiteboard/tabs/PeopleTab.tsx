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
  Monitor,
  MessageSquare,
  LogOut,
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
  stream?: MediaStream | null;
}

export interface PeopleTabProps {
  participants?: Participant[];
  currentUserRole?: 'teacher' | 'student';
  permissions?: WhiteboardPermissions;
  onToggleGlobalLock?: (locked: boolean) => void;
  onToggleStudentDrawing?: (studentId: string, allowed: boolean) => void;
  onToggleLaserOnly?: (laserOnly: boolean) => void;
  onMuteAll?: () => void;
  onRemoteToggleMic?: (studentId: string) => void;
  onRemoteToggleCamera?: (studentId: string) => void;
  isScreenShareAllowedForStudents?: boolean;
  onToggleScreenShareAllowed?: (allowed: boolean) => void;
  isChatEnabledForStudents?: boolean;
  onToggleChatEnabled?: (enabled: boolean) => void;
  onEndClass?: () => void;
  className?: string;
}

export const PeopleTab: React.FC<PeopleTabProps> = ({
  participants = [],
  currentUserRole = 'student',
  permissions = defaultWhiteboardPermissions(),
  onToggleGlobalLock,
  onToggleStudentDrawing,
  onToggleLaserOnly,
  onMuteAll,
  onRemoteToggleMic,
  onRemoteToggleCamera,
  isScreenShareAllowedForStudents = false,
  onToggleScreenShareAllowed,
  isChatEnabledForStudents = true,
  onToggleChatEnabled,
  onEndClass,
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
          className="flex flex-col gap-2.5 pb-3 border-b border-stone-200"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-600">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>Classroom Authority</span>
          </div>

          {/* Mute All Students Button */}
          <button
            type="button"
            data-testid="mute-all-btn"
            onClick={onMuteAll}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <MicOff className="w-4 h-4 text-rose-600" />
            <span>Mute All Students</span>
          </button>

          {/* Student Screen Share Permission Switch */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm"
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isScreenShareAllowedForStudents
                    ? 'bg-sky-50 text-sky-600 border border-sky-200'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-900">Student Screen Share</div>
                <div className="text-xs text-stone-500">Allow students to share screen</div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isScreenShareAllowedForStudents}
              data-testid="toggle-screen-share-allowed"
              aria-label="Student Screen Share Permission"
              onClick={() => onToggleScreenShareAllowed?.(!isScreenShareAllowedForStudents)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isScreenShareAllowedForStudents ? 'bg-sky-600' : 'bg-stone-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isScreenShareAllowedForStudents ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* In-Class Chat Switch */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm"
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isChatEnabledForStudents
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-900">In-Class Chat</div>
                <div className="text-xs text-stone-500">Enable student messaging</div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isChatEnabledForStudents}
              data-testid="toggle-chat-enabled"
              aria-label="In-Class Chat Permission"
              onClick={() => onToggleChatEnabled?.(!isChatEnabledForStudents)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isChatEnabledForStudents ? 'bg-emerald-600' : 'bg-stone-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isChatEnabledForStudents ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Global Lock Switch (Optional / Backward-compatible) */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm"
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  permissions.isLockedGlobally
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}
              >
                {permissions.isLockedGlobally ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-900">Global Lock</div>
                <div className="text-xs text-stone-500">Lock Whiteboard for All</div>
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
                permissions.isLockedGlobally ? 'bg-rose-600' : 'bg-stone-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  permissions.isLockedGlobally ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Laser Pointer Only Switch */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm"
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  permissions.laserPointerOnly
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-900">Laser Pointer Only</div>
                <div className="text-xs text-stone-500">Restrict students to pointer</div>
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
                permissions.laserPointerOnly ? 'bg-amber-600' : 'bg-stone-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  permissions.laserPointerOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* End Class Quick Action */}
          {onEndClass && (
            <button
              type="button"
              data-testid="studio-end-class-btn"
              onClick={onEndClass}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors mt-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-stone-600" />
              <span>Wrap Up & End Class</span>
            </button>
          )}
        </section>
      )}

      {/* Participants List */}
      <section
        data-testid="participants-section"
        aria-label="Classroom Participants"
        className="flex flex-col gap-2.5 flex-1"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-stone-500 tracking-wider uppercase">
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
              <div
                key={participant.id}
                data-testid={`participant-card-${participant.id}`}
                className="flex flex-col p-3 rounded-xl gap-2 border border-stone-200 bg-white text-stone-900 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  {/* Name & Avatar */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-700 flex items-center justify-center text-white text-xs font-semibold">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-stone-900 truncate">
                          {participant.name}
                        </span>
                        {participant.isSelf && (
                          <span className="text-[10px] text-stone-400 font-normal">(You)</span>
                        )}
                      </div>
                      <span
                        data-testid={`role-badge-${participant.id}`}
                        className={`text-[10px] font-medium tracking-wide w-fit px-1.5 py-0.5 rounded-full ${
                          participant.role === 'teacher'
                            ? 'bg-amber-500/15 text-amber-700 border border-amber-500/25'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        {participant.role === 'teacher' ? 'Teacher' : 'Student'}
                      </span>
                    </div>
                  </div>

                  {/* Mic / Video Status Indicators & Remote Controls */}
                  <div
                    data-testid={`media-indicators-${participant.id}`}
                    className="flex items-center gap-1.5 flex-shrink-0"
                  >
                    {isTeacher && isStudent && onRemoteToggleMic ? (
                      <button
                        type="button"
                        data-testid={`remote-mic-btn-${participant.id}`}
                        title={participant.isMicOn ? 'Mute student microphone' : 'Unmute student microphone'}
                        onClick={() => onRemoteToggleMic(participant.id)}
                        className={`p-1 rounded-md border transition-colors cursor-pointer ${
                          participant.isMicOn
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                            : 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span data-testid={`mic-status-${participant.id}`}>
                          {participant.isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    ) : (
                      <span
                        title={participant.isMicOn ? 'Microphone on' : 'Microphone muted'}
                        data-testid={`mic-status-${participant.id}`}
                        className={`p-1 rounded-md ${
                          participant.isMicOn
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-stone-400 bg-stone-100'
                        }`}
                      >
                        {participant.isMicOn ? (
                          <Mic className="w-3.5 h-3.5" />
                        ) : (
                          <MicOff className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}

                    {isTeacher && isStudent && onRemoteToggleCamera ? (
                      <button
                        type="button"
                        data-testid={`remote-camera-btn-${participant.id}`}
                        title={participant.isCameraOn ? 'Turn off student camera' : 'Turn on student camera'}
                        onClick={() => onRemoteToggleCamera(participant.id)}
                        className={`p-1 rounded-md border transition-colors cursor-pointer ${
                          participant.isCameraOn
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                            : 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span data-testid={`camera-status-${participant.id}`}>
                          {participant.isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    ) : (
                      <span
                        title={participant.isCameraOn ? 'Camera on' : 'Camera off'}
                        data-testid={`camera-status-${participant.id}`}
                        className={`p-1 rounded-md ${
                          participant.isCameraOn
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-stone-400 bg-stone-100'
                        }`}
                      >
                        {participant.isCameraOn ? (
                          <Video className="w-3.5 h-3.5" />
                        ) : (
                          <VideoOff className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Per-student drawing permission toggle (Teacher only) */}
                {isTeacher && isStudent && (
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex items-center gap-1.5 text-xs text-stone-600">
                      <Edit3 className="w-3 h-3 text-amber-600" />
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
                        hasDrawingAccess ? 'bg-amber-600' : 'bg-stone-200'
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
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default PeopleTab;
