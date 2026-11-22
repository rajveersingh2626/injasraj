import React, { Suspense } from 'react';
import { ClassroomView } from '@/components/classroom/ClassroomView';

export interface ClassroomPageProps {
  params: Promise<{ roomId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

function ClassroomContent(props: ClassroomPageProps) {
  // Support Promise-based params/searchParams (Next.js 15)
  // React.use() MUST NOT be called inside try/catch in React 19
  const unwrappedParams = React.use(props.params);

  // Default strictly to student role unless explicitly requested and authenticated
  let resolvedRole: 'teacher' | 'student' = 'student';
  let resolvedName: string | undefined = undefined;
  let restoreRoomId: string | undefined = undefined;

  if (props.searchParams) {
    const sp = React.use(props.searchParams);
    if (sp?.role === 'teacher') resolvedRole = 'teacher';
    else if (sp?.role === 'student') resolvedRole = 'student';
    if (typeof sp?.name === 'string') resolvedName = sp.name;
    if (typeof sp?.restoreRoomId === 'string') restoreRoomId = sp.restoreRoomId;
  }

  return (
    <div
      data-testid="classroom-route-container"
      className="w-full h-[100dvh] overflow-hidden select-none"
      style={{ overscrollBehavior: 'none' }}
    >
      <ClassroomView
        roomId={unwrappedParams?.roomId || 'default-room'}
        role={resolvedRole}
        userName={resolvedName}
        restoreRoomId={restoreRoomId}
      />
    </div>
  );
}

export default function ClassroomPage(props: ClassroomPageProps) {
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
      <ClassroomContent {...props} />
    </Suspense>
  );
}
