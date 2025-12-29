// src/components/ErrorBoundary.tsx
import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-gray-900 px-4 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-xl p-8 border border-neutral-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-gray-100 mb-4">
              Something went wrong
            </h1>
            <p className="text-neutral-600 dark:text-gray-400 mb-6">
              We apologize for the inconvenience. The error has been logged and we&apos;ll
              investigate.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="bg-danger-50 dark:bg-red-900 text-danger-800 dark:text-red-200 p-4 rounded-lg text-sm overflow-auto mb-6 max-h-48">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-brand-700 transition-colors touch-target"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
