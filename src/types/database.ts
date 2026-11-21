export interface Profile {
  id: string;
  role: 'teacher' | 'student';
  full_name: string;
  timezone: string;
  created_at?: string;
}

export interface TeacherAvailability {
  id: string;
  teacher_id: string;
  day_of_week: number; // 0 (Sun) - 6 (Sat)
  start_time: string; // HH:mm:ss format
  end_time: string; // HH:mm:ss format
  slot_duration_minutes: number;
}

export interface Lesson {
  id: string;
  room_id: string;
  teacher_id: string;
  student_id?: string | null;
  student_name: string;
  student_email: string;
  start_time_utc: string; // ISO-8601 string in UTC
  end_time_utc: string; // ISO-8601 string in UTC
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  created_at?: string;
}
