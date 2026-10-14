'use server';

/**
 * Admin passcode gate — fully server-side.
 *
 * The passcode lives in `ADMIN_PASSCODE` (env var, never bundled). Unlocking
 * exchanges a submitted passcode for an HttpOnly session cookie whose value is
 * a SHA-256 digest of the configured passcode, so the cookie never carries the
 * plaintext and can only be validated on the server.
 */

import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';

const ADMIN_COOKIE = 'admin_session';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours

export interface AdminAuthState {
  ok: boolean;
  error?: string;
}

function sessionTokenFor(passcode: string): string {
  // Namespace the digest so the same passcode reused elsewhere hashes differently.
  return createHash('sha256').update(`moviedekho:admin:${passcode}`).digest('hex');
}

/** Verify the submitted passcode against the env var and set the session cookie. */
export async function unlockAdmin(
  _previousState: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) {
    return {
      ok: false,
      error:
        'ADMIN_PASSCODE is not configured on the server. Add it to the deployment environment variables, then redeploy.',
    };
  }

  const submitted = String(formData.get('passcode') ?? '').trim();
  if (!submitted) {
    return { ok: false, error: 'Passcode is required.' };
  }

  if (submitted !== expected) {
    return { ok: false, error: 'Incorrect passcode. Try again.' };
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sessionTokenFor(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  revalidatePath('/admin');
  return { ok: true };
}

/** Clear the admin session. */
export async function lockAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  revalidatePath('/admin');
}

/** Server-side session check — the only "true/false" source for the page shell. */
export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;

  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  if (!value) return false;

  // Constant-time-ish comparison via digest equality; passcode never read from
  // the cookie, only compared against the digest it would produce.
  return value === sessionTokenFor(expected);
}
