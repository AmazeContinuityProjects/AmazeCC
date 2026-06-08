import { cookies } from 'next/headers';
import AdminDashboard from '@/components/custom/dayscholar/AdminDashboard';
import LoginForm from './LoginForm';
import { verifyAdminToken } from '@/lib/auth';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_auth')?.value;
  
  const verifiedUsername = token ? verifyAdminToken(token) : null;
  const isAuthenticated = !!verifiedUsername;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 midnight:bg-black p-4">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 midnight:bg-black p-4 md:p-10">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          Admin Portal <span className="text-sm font-normal text-gray-500 ml-2">Logged in as: {verifiedUsername}</span>
        </h1>
        <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
          &larr; Back to App
        </a>
      </div>
      <AdminDashboard />
    </div>
  );
}
