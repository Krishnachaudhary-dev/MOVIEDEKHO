import { createClient, type SupabaseClient } from '@supabase/supabase-js/dist/index.cjs';

/**
 * Server-side Supabase client.
 *
 * Environment naming is deliberately forgiving. Deployments have used every
 * combination of public/private and `ANON_KEY` / `SECRET_KEY` spellings, and a
 * name mismatch used to surface as an opaque "could not save the stream
 * source" error in the admin tool. Every name below is accepted.
 */

/** Accepted URL variable names, highest precedence first. */
export const SUPABASE_URL_ENV_VARS = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const;

/**
 * Accepted key variable names, highest precedence first. The service-role /
 * secret keys come first because the admin tool writes rows and therefore
 * needs a key that can get past row-level security.
 */
export const SUPABASE_KEY_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
] as const;

/** The private (RLS-bypassing) key names, in precedence order. */
const SERVICE_KEY_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
] as const;

function readFirstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** The configured Supabase project URL, whichever spelling it uses. */
export function getSupabaseUrl(): string | undefined {
  return readFirstEnv(SUPABASE_URL_ENV_VARS);
}

/** The configured Supabase API key, whichever spelling it uses. */
export function getSupabaseKey(): string | undefined {
  return readFirstEnv(SUPABASE_KEY_ENV_VARS);
}

/** True when the configured key can write past RLS (service-role/secret key). */
export function hasSupabaseServiceKey(): boolean {
  return Boolean(readFirstEnv(SERVICE_KEY_ENV_VARS));
}

/** True when both a URL and a key are configured. */
export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

let _client: SupabaseClient | null = null;
let _clientConfig: string | null = null;

export function getSupabaseClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    const missing = [
      url ? null : `a URL (${SUPABASE_URL_ENV_VARS.join(' or ')})`,
      key ? null : `a key (${SUPABASE_KEY_ENV_VARS.join(' or ')})`,
    ].filter((entry): entry is string => entry !== null);

    throw new Error(
      `Supabase is not configured: set ${missing.join(', and ')} in the deployment environment, then redeploy.`,
    );
  }

  // Re-create the client if the environment changed (tests, rotated keys).
  const config = `${url}\u0000${key}`;
  if (_client && _clientConfig === config) {
    return _client;
  }

  _client = createClient(url, key);
  _clientConfig = config;
  return _client;
}

/** Reset the cached client — useful for tests. */
export function resetSupabaseClient(): void {
  _client = null;
  _clientConfig = null;
}

/** The subset of a PostgREST/Postgres error we report back to the admin. */
export interface SupabaseErrorLike {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Postgres/PostgREST codes we can turn into an actionable sentence. Anything
 * not listed still reports the raw message and code instead of being masked.
 */
const SUPABASE_ERROR_HINTS: Record<string, string> = {
  '42P01':
    'the table does not exist — apply supabase/schema.sql to this Supabase project.',
  PGRST205:
    'the table is missing from the schema cache — apply supabase/schema.sql to this Supabase project.',
  '42703':
    'the column does not exist — re-run supabase/schema.sql for this project to add the per-episode columns.',
  '42501':
    'row-level security rejected the write — set SUPABASE_SERVICE_ROLE_KEY (private, server-only) instead of using the anon key.',
  '23505': 'a row with that unique key already exists.',
  '23503': 'a referenced row does not exist yet.',
  '40P01': 'the transaction was deadlocked — retry the request.',
  '57014': 'the query was cancelled because it took too long.',
  '08006': 'the connection to Supabase failed — retry the request.',
  PGRST301: 'the API key was rejected — check the Supabase env vars and redeploy.',
  '401': 'the API key was rejected — check the Supabase env vars and redeploy.',
  '403': 'the request was forbidden — check the Supabase env vars and redeploy.',
};

/**
 * Build a human-readable, non-masking description of a Supabase failure.
 * Always includes the provider's own message so a missing table or an RLS
 * policy violation is visible instead of being replaced by a generic string.
 */
export function describeSupabaseError(
  context: string,
  error: SupabaseErrorLike,
): string {
  const message =
    [error.message, error.details].filter(Boolean).join(' — ') ||
    error.hint ||
    'Supabase returned an error with no message.';

  const code = error.code ? String(error.code) : undefined;
  const hint = code ? SUPABASE_ERROR_HINTS[code] : undefined;

  return [
    `${context}: ${message}`,
    code ? `(Supabase code ${code})` : null,
    hint ? `Hint: ${hint}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
