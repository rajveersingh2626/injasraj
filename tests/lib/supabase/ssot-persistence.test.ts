/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createBrowserClient } from '@/lib/supabase/client';
import { CANONICAL_TEACHER_ID } from '@/lib/auth/teacher-auth';

describe('Supabase Normalized SSOT Live Database Verification', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iyyefgompkzhnjoxjoky.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  });

  it('queries the seeded canonical teacher profile in public.profiles', async () => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', CANONICAL_TEACHER_ID)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.full_name).toBe('Inderjit Kaur');
    expect(data.role).toBe('teacher');
  });

  it('inserts and reads teacher availability in public.teacher_availability', async () => {
    const supabase = createBrowserClient();
    const testAvailability = [
      {
        teacher_id: CANONICAL_TEACHER_ID,
        day_of_week: 1,
        start_time: '16:00:00',
        end_time: '21:00:00',
        slot_duration_minutes: 60,
      },
      {
        teacher_id: CANONICAL_TEACHER_ID,
        day_of_week: 2,
        start_time: '16:00:00',
        end_time: '21:00:00',
        slot_duration_minutes: 60,
      },
    ];

    const { error: upsertErr } = await supabase
      .from('teacher_availability')
      .upsert(testAvailability, { onConflict: 'teacher_id,day_of_week' });
    expect(upsertErr).toBeNull();

    const { data, error: selectErr } = await supabase
      .from('teacher_availability')
      .select('*')
      .eq('teacher_id', CANONICAL_TEACHER_ID)
      .order('day_of_week', { ascending: true });

    expect(selectErr).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThanOrEqual(2);
  });

  it('inserts, queries, and updates active room in public.lessons SSOT', async () => {
    const supabase = createBrowserClient();
    const testRoomId = `ssot-room-${Date.now()}`;

    // 1. Insert instant room
    const { error: insertErr } = await supabase.from('lessons').insert({
      room_id: testRoomId,
      teacher_id: CANONICAL_TEACHER_ID,
      room_type: 'instant',
      title: 'Instant 1:1 Live Test Session',
      status: 'live',
    });
    expect(insertErr).toBeNull();

    // 2. Query room by room_id
    const { data: queried, error: queryErr } = await supabase
      .from('lessons')
      .select('*')
      .eq('room_id', testRoomId)
      .single();

    expect(queryErr).toBeNull();
    expect(queried.room_id).toBe(testRoomId);
    expect(queried.status).toBe('live');
    expect(queried.teacher_id).toBe(CANONICAL_TEACHER_ID);

    // 3. Mark completed (past class)
    const { error: updateErr } = await supabase
      .from('lessons')
      .update({ status: 'completed' })
      .eq('room_id', testRoomId);
    expect(updateErr).toBeNull();

    // 4. Verify status updated
    const { data: updated } = await supabase
      .from('lessons')
      .select('status')
      .eq('room_id', testRoomId)
      .single();
    expect(updated?.status).toBe('completed');

    // Clean up test lesson
    await supabase.from('lessons').delete().eq('room_id', testRoomId);
  });
});
