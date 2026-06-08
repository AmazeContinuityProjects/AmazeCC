'use client';
import { useState } from 'react';
import { API_BASE } from "@/components/custom/Main";

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // We hit the amazecc-api backend route directly
      const res = await fetch(`${API_BASE}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        // Set the signed token as a local cookie
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration
        document.cookie = `admin_auth=${data.token}; path=/; expires=${expirationDate.toUTCString()}; samesite=lax`;
        
        window.location.reload();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-800 midnight:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 midnight:border-gray-800 p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">
          Admin Authentication
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Please log in with your VTOP credentials to verify your identity.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            VTOP Registration Number
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            placeholder="e.g. 21BCE0000"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            VTOP Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors shadow-md disabled:bg-gray-400"
        >
          {isLoading ? 'Verifying with VTOP...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
