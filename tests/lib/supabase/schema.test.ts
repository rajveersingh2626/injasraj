import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseConfig, createBrowserClient, createClient } from '../../../src/lib/supabase/client';
import { createServerSupabaseClient } from '../../../src/lib/supabase/server';

describe('Supabase Database Schema & SQL Migration', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261121000000_init_schema.sql');

  it('migration file exists at supabase/migrations/20261121000000_init_schema.sql', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('defines profiles table with required columns and constraints', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?profiles/i);
    expect(sql).toMatch(/references\s+auth\.users\(id\)\s+on\s+delete\s+cascade/i);
    expect(sql).toMatch(/role\s+text\s+not\s+null\s+check\s*\(\s*role\s+in\s*\(\s*'teacher'\s*,\s*'student'\s*\)\s*\)/i);
    expect(sql).toMatch(/full_name\s+text\s+not\s+null/i);
    expect(sql).toMatch(/timezone\s+text\s+not\s+null\s+default\s+'Asia\/Kolkata'/i);
    expect(sql).toMatch(/created_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i);
  });

  it('defines teacher_availability table with day_of_week check constraint', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?teacher_availability/i);
    expect(sql).toMatch(/teacher_id\s+uuid\s+not\s+null\s+references\s+(public\.)?profiles\(id\)\s+on\s+delete\s+cascade/i);
    expect(sql).toMatch(/day_of_week\s+int\s+not\s+null\s+check\s*\(\s*day_of_week\s+between\s+0\s+and\s+6\s*\)/i);
    expect(sql).toMatch(/start_time\s+time\s+not\s+null/i);
    expect(sql).toMatch(/end_time\s+time\s+not\s+null/i);
    expect(sql).toMatch(/slot_duration_minutes\s+int\s+not\s+null\s+default\s+60/i);
  });

  it('defines lessons table with room_id uniqueness and status checks', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?lessons/i);
    expect(sql).toMatch(/room_id\s+text\s+not\s+null\s+unique/i);
    expect(sql).toMatch(/teacher_id\s+uuid\s+not\s+null\s+references\s+(public\.)?profiles\(id\)\s+on\s+delete\s+cascade/i);
    expect(sql).toMatch(/student_id\s+uuid\s+references\s+(public\.)?profiles\(id\)\s+on\s+delete\s+set\s+null/i);
    expect(sql).toMatch(/student_name\s+text\s+not\s+null/i);
    expect(sql).toMatch(/student_email\s+text\s+not\s+null/i);
    expect(sql).toMatch(/start_time_utc\s+timestamptz\s+not\s+null/i);
    expect(sql).toMatch(/end_time_utc\s+timestamptz\s+not\s+null/i);
    expect(sql).toMatch(/status\s+text\s+not\s+null\s+check\s*\(\s*status\s+in\s*\(\s*'scheduled'\s*,\s*'live'\s*,\s*'completed'\s*,\s*'cancelled'\s*\)\s*\)/i);
  });

  it('creates required indexes on room_id, teacher_id, start_time_utc, and day_of_week', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/create\s+(unique\s+)?index[\s\S]*?on\s+(public\.)?lessons\s*\(\s*room_id\s*\)/i);
    expect(sql).toMatch(/create\s+(unique\s+)?index[\s\S]*?on\s+(public\.)?lessons\s*\(\s*teacher_id\s*,\s*start_time_utc\s*\)/i);
    expect(sql).toMatch(/create\s+(unique\s+)?index[\s\S]*?on\s+(public\.)?teacher_availability\s*\(\s*teacher_id\s*,\s*day_of_week\s*\)/i);
  });

  it('enables RLS on profiles, teacher_availability, and lessons', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql).toMatch(/alter\s+table\s+(public\.)?profiles\s+enable\s+row\s+level\s+security/i);
    expect(sql).toMatch(/alter\s+table\s+(public\.)?teacher_availability\s+enable\s+row\s+level\s+security/i);
    expect(sql).toMatch(/alter\s+table\s+(public\.)?lessons\s+enable\s+row\s+level\s+security/i);
  });

  it('contains RLS policies for profiles, availability, and lessons', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    // Profiles
    expect(sql).toMatch(/create\s+policy[\s\S]*?on\s+(public\.)?profiles\s+for\s+select/i);
    expect(sql).toMatch(/create\s+policy[\s\S]*?on\s+(public\.)?profiles\s+for\s+update/i);
    // Teacher availability
    expect(sql).toMatch(/create\s+policy[\s\S]*?on\s+(public\.)?teacher_availability\s+for\s+select/i);
    expect(sql).toMatch(/create\s+policy[\s\S]*?on\s+(public\.)?teacher_availability\s+for\s+insert/i);
    // Lessons
    expect(sql).toMatch(/create\s+policy[\s\S]*?on\s+(public\.)?lessons\s+for\s+insert/i);
    expect(sql).toMatch(/create\s+policy[\s\S]*?on\s+(public\.)?lessons\s+for\s+(select|all)/i);
  });
});

describe('Supabase Client Config & Factories', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (originalAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('reads environment variables or falls back to safe local mock', () => {
    const config = getSupabaseConfig();
    expect(config.url).toBeDefined();
    expect(config.url).toContain('supabase.co');
    expect(config.anonKey).toBeDefined();
    expect(config.anonKey.length).toBeGreaterThan(0);
  });

  it('respects explicitly set environment variables', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://custom-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'custom-anon-jwt-token';

    const config = getSupabaseConfig();
    expect(config.url).toBe('https://custom-project.supabase.co');
    expect(config.anonKey).toBe('custom-anon-jwt-token');
  });

  it('creates browser Supabase client with auth and channel capabilities', () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.channel).toBe('function');
    expect(client.auth).toBeDefined();
  });

  it('creates client using createClient alias', () => {
    const client = createClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('creates server Supabase client safely outside request context', async () => {
    const serverClient = await createServerSupabaseClient();
    expect(serverClient).toBeDefined();
    expect(typeof serverClient.from).toBe('function');
    expect(serverClient.auth).toBeDefined();
  });
});
