import { describe, it, expect } from 'vitest';
import {
  buildSupavisorDatabaseUrl,
  getActivePoolerConfig,
  validateRlsSecurityContext,
  simulateQueryCostBenchmark,
} from '@/lib/supabase/pooler';

describe('PostgreSQL Optimization & Best Practices Suite', () => {
  describe('Supavisor Connection Pooling (Port 6543 & Transaction Mode)', () => {
    it('generates a Supavisor connection URL configured for port 6543 in transaction mode', () => {
      const url = buildSupavisorDatabaseUrl({
        projectId: 'injasraj-test-proj',
        region: 'ap-south-1',
        mode: 'transaction',
        statementTimeoutMs: 3000,
      });

      expect(url).toContain(':6543/');
      expect(url).toContain('pool_mode=transaction');
      expect(url).toContain('connect_timeout=10');
      expect(url).toContain('statement_timeout=3000');
      expect(url).toContain('sslmode=require');
    });

    it('generates a direct session URL for port 5432 when session mode is explicitly requested', () => {
      const url = buildSupavisorDatabaseUrl({
        projectId: 'injasraj-test-proj',
        mode: 'session',
      });

      expect(url).toContain(':5432/');
      expect(url).toContain('pool_mode=session');
    });

    it('returns default active pooler configuration tailored for serverless operations', () => {
      const config = getActivePoolerConfig();
      expect(config.port).toBe(6543);
      expect(config.poolMode).toBe('transaction');
      expect(config.connectionTimeoutSeconds).toBe(10);
      expect(config.statementTimeoutMs).toBe(5000);
    });
  });

  describe('Row-Level Security (RLS) Policy Guardrails', () => {
    it('blocks students from mutating teacher profiles', () => {
      const result = validateRlsSecurityContext({
        actorRole: 'student',
        actorId: 'student-alex',
        targetResource: 'teacher_profile',
        action: 'update',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('RLS VIOLATION');
    });

    it('allows teachers to update teacher profile', () => {
      const result = validateRlsSecurityContext({
        actorRole: 'teacher',
        actorId: 'teacher-inderjit',
        targetResource: 'teacher_profile',
        action: 'update',
      });

      expect(result.allowed).toBe(true);
    });

    it('blocks students from modifying a locked whiteboard page', () => {
      const result = validateRlsSecurityContext({
        actorRole: 'student',
        actorId: 'student-alex',
        targetResource: 'whiteboard_page',
        action: 'update',
        isLocked: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Page is locked by the teacher');
    });

    it('allows students to view whiteboard pages even if locked', () => {
      const result = validateRlsSecurityContext({
        actorRole: 'student',
        actorId: 'student-alex',
        targetResource: 'whiteboard_page',
        action: 'select',
        isLocked: true,
      });

      expect(result.allowed).toBe(true);
    });

    it('blocks students from deleting rooms', () => {
      const result = validateRlsSecurityContext({
        actorRole: 'student',
        actorId: 'student-alex',
        targetResource: 'room',
        action: 'delete',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Students cannot delete');
    });

    it('allows service_role to execute any maintenance action (e.g. room sweeper)', () => {
      const result = validateRlsSecurityContext({
        actorRole: 'service_role',
        actorId: 'vercel-cron',
        targetResource: 'room',
        action: 'delete',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Query Execution Cost & Benchmark Performance', () => {
    it('demonstrates sub-5ms query latency for indexed active room lookups', async () => {
      const benchmark = await simulateQueryCostBenchmark('active_room_lookup');
      expect(benchmark.isUnderTarget).toBe(true);
      expect(benchmark.simulatedLatencyMs).toBeLessThan(5);
    });

    it('demonstrates sub-5ms query latency for room sweeper index scans', async () => {
      const benchmark = await simulateQueryCostBenchmark('room_sweep');
      expect(benchmark.isUnderTarget).toBe(true);
      expect(benchmark.simulatedLatencyMs).toBeLessThan(5);
    });
  });
});
