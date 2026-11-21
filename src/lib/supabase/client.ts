import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const DEFAULT_MOCK_URL = 'https://mock-classroom-project.supabase.co';
const DEFAULT_MOCK_ANON_KEY = 'mock-anon-jwt-token-for-local-testing';

/**
 * Returns Supabase configuration values from environment variables
 * or safe mock fallbacks for testing/local offline development.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_MOCK_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_MOCK_ANON_KEY;
  return { url, anonKey };
}

/**
 * Creates a browser-side Supabase client using @supabase/ssr.
 */
export function createBrowserClient<Database = any>(
  customUrl?: string,
  customAnonKey?: string
) {
  const config = getSupabaseConfig();
  const url = customUrl || config.url;
  const anonKey = customAnonKey || config.anonKey;
  return createSupabaseBrowserClient<Database>(url, anonKey);
}

/**
 * Default client factory alias for browser environments.
 */
export function createClient<Database = any>(
  customUrl?: string,
  customAnonKey?: string
) {
  return createBrowserClient<Database>(customUrl, customAnonKey);
}
