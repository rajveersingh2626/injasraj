-- Migration: 20261128000001_align_rls_for_canonical_teacher.sql
-- Description: Align RLS policies for canonical teacher ID and classroom room_id updates

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_availability' AND policyname = 'Teacher can manage availability'
  ) THEN
    CREATE POLICY "Teacher can manage availability"
      ON public.teacher_availability
      FOR ALL
      USING (
        teacher_id = '00000000-0000-0000-0000-000000000001'::uuid 
        OR (auth.uid() IS NOT NULL AND auth.uid() = teacher_id)
      )
      WITH CHECK (
        teacher_id = '00000000-0000-0000-0000-000000000001'::uuid 
        OR (auth.uid() IS NOT NULL AND auth.uid() = teacher_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lessons' AND policyname = 'Anyone can update lesson by room_id'
  ) THEN
    CREATE POLICY "Anyone can update lesson by room_id"
      ON public.lessons
      FOR UPDATE
      USING (
        room_id IS NOT NULL 
        OR teacher_id = '00000000-0000-0000-0000-000000000001'::uuid 
        OR (auth.uid() IS NOT NULL AND auth.uid() = teacher_id)
      )
      WITH CHECK (
        room_id IS NOT NULL 
        OR teacher_id = '00000000-0000-0000-0000-000000000001'::uuid 
        OR (auth.uid() IS NOT NULL AND auth.uid() = teacher_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lessons' AND policyname = 'Anyone can delete lesson by room_id'
  ) THEN
    CREATE POLICY "Anyone can delete lesson by room_id"
      ON public.lessons
      FOR DELETE
      USING (
        room_id IS NOT NULL 
        OR teacher_id = '00000000-0000-0000-0000-000000000001'::uuid 
        OR (auth.uid() IS NOT NULL AND auth.uid() = teacher_id)
      );
  END IF;
END $$;
