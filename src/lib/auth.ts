import { cookies } from 'next/headers';

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}
