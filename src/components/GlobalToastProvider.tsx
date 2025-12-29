import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextType {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function GlobalToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    type: 'error' | 'success';
  } | null>(null);

  const showError = useCallback((message: string) => {
    setToast({ message, type: 'error' });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-xl shadow-lg text-lg font-bold border ${
            toast.type === 'error'
              ? 'bg-danger-100 dark:bg-red-900 text-danger-700 dark:text-red-200 border-danger-700 dark:border-red-700'
              : 'bg-success-100 dark:bg-green-900 text-success-700 dark:text-green-200 border-success-700 dark:border-green-700'
          }`}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a GlobalToastProvider');
  }
  return context;
}
