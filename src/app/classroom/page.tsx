import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ClassroomView } from '@/components/classroom/ClassroomView';

export interface ClassroomQueryPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

function ClassroomQueryContent(props: ClassroomQueryPageProps) {
  let resolvedRoomId: string = 'default-room';
  let resolvedRole: 'teacher' | 'student' = 'student';
  let resolvedName: string | undefined = undefined;
  let restoreRoomId: string | undefined = undefined;

  if (props.searchParams) {
    const sp = React.use(props.searchParams);
    const roomParam = sp?.room || sp?.roomId;
    if (sp?.role === 'teacher') resolvedRole = 'teacher';
    else if (sp?.role === 'student') resolvedRole = 'student';
    if (typeof sp?.name === 'string') resolvedName = sp.name;
    if (typeof sp?.restoreRoomId === 'string') restoreRoomId = sp.restoreRoomId;

    // If room is present, redirect to canonical path /classroom/[roomId]
    if (typeof roomParam === 'string' && roomParam.trim() !== '') {
      resolvedRoomId = roomParam.trim();
      const qParams = new URLSearchParams();
      if (resolvedRole) qParams.set('role', resolvedRole);
      if (resolvedName) qParams.set('name', resolvedName);
      if (restoreRoomId) qParams.set('restoreRoomId', restoreRoomId);
      const queryStr = qParams.toString();
      redirect(`/classroom/${encodeURIComponent(resolvedRoomId)}${queryStr ? `?${queryStr}` : ''}`);
    }
  }

  return (
    <div
      data-testid="classroom-route-container"
      className="w-full h-[100dvh] overflow-hidden select-none"
      style={{ overscrollBehavior: 'none' }}
    >
      <ClassroomView
        roomId={resolvedRoomId}
        role={resolvedRole}
        userName={resolvedName}
        restoreRoomId={restoreRoomId}
      />
    </div>
  );
}

export default function ClassroomQueryPage(props: ClassroomQueryPageProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Entering Classroom...</p>
          </div>
        </div>
      }
    >
      <ClassroomQueryContent {...props} />
    </Suspense>
  );
}
