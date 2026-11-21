import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './client';

/**
 * Creates a server-side Supabase client using @supabase/ssr with Next.js cookie handling.
 * Safely falls back if called outside a request context (e.g. in tests or background jobs).
 */
export async function createServerSupabaseClient<Database = any>(
  customUrl?: string,
  customAnonKey?: string
) {
  const config = getSupabaseConfig();
  const url = customUrl || config.url;
  const anonKey = customAnonKey || config.anonKey;

  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Gracefully handle invocation outside active Next.js request lifecycle
    cookieStore = null;
  }

  return createSupabaseServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll?.() ?? [];
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore?.set?.(name, value, options);
          });
        } catch {
          // Ignore writes attempted from ReadonlyHeaders/Server Components
        }
      },
    },
  });
}

export const createClient = createServerSupabaseClient;
export const createServerClient = createServerSupabaseClient;
