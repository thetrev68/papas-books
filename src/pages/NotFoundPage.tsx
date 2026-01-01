import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 rounded-2xl shadow-sm p-8 text-center">
        <h1 className="text-6xl font-bold text-neutral-900 dark:text-gray-100 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-gray-200 mb-2">
          Page Not Found
        </h2>
        <p className="text-lg text-neutral-600 dark:text-gray-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
