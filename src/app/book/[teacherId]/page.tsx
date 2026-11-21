import React, { Suspense } from 'react';
import { BookTeacherView } from '@/components/booking/BookTeacherView';

export interface BookPageProps {
  params: Promise<{ teacherId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

function BookTeacherContent({ params }: BookPageProps) {
  const unwrappedParams = React.use(params);
  return <BookTeacherView teacherId={unwrappedParams?.teacherId || 'teacher-1'} />;
}

export default function BookTeacherPage(props: BookPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading booking calendar...</p>
          </div>
        </div>
      }
    >
      <BookTeacherContent {...props} />
    </Suspense>
  );
}
