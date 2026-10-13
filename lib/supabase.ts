import { createClient, type SupabaseClient } from '@supabase/supabase-js/dist/index.cjs';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set before creating the Supabase client.',
    );
  }

  _client = createClient(url, anonKey);
  return _client;
}

/** Reset the cached client — useful for tests. */
export function resetSupabaseClient(): void {
  _client = null;
}
