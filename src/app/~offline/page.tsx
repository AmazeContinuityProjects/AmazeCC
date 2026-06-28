import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-4">
            <div className="bg-white  dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                    <WifiOff className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    You're Offline
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    It looks like you've lost your internet connection. We couldn't load this page from the cache.
                </p>
                <Link href="/">
                    <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors">
                        Go to Home
                    </span>
                </Link>
            </div>
        </div>
    );
}
