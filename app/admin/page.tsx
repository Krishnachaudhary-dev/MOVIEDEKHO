import { isAdminAuthenticated } from '@/app/actions/auth';

import AdminGate from './AdminGate';
import AdminForm from './AdminForm';

/**
 * Admin route — server component. Authentication is judged here, on the
 * server, by the HttpOnly `admin_session` cookie validated against
 * ADMIN_PASSCODE. Unauthenticated visitors only ever receive the passcode
 * gate; the form is not included in their HTML payload at all.
 */
export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  return authed ? <AdminForm /> : <AdminGate />;
}
