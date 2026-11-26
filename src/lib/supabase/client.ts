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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      console.error(
        'CRITICAL: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in production.'
      );
    }
  }

  return {
    url: url || DEFAULT_MOCK_URL,
    anonKey: anonKey || DEFAULT_MOCK_ANON_KEY,
  };
}

// Global / module singleton cache to avoid multiple GoTrueClient instances
declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowserClientCache: Map<string, any> | undefined;
}

const clientCache =
  globalThis.__supabaseBrowserClientCache ||
  (globalThis.__supabaseBrowserClientCache = new Map<string, any>());

/**
 * Creates or returns a cached browser-side Supabase client singleton using @supabase/ssr.
 */
export function createBrowserClient<Database = any>(
  customUrl?: string,
  customAnonKey?: string
) {
  const config = getSupabaseConfig();
  const url = customUrl || config.url;
  const anonKey = customAnonKey || config.anonKey;
  const cacheKey = `${url}::${anonKey}`;

  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, createSupabaseBrowserClient<Database>(url, anonKey));
  }

  return clientCache.get(cacheKey) as ReturnType<typeof createSupabaseBrowserClient<Database>>;
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
