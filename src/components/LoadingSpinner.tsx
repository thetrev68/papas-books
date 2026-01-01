export function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
