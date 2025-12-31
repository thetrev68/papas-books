import React, { createContext, useContext, useState, useCallback } from 'react';

interface ConfirmOptions {
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ToastContextType {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  showConfirm: (message: string, options: ConfirmOptions) => void;
}

type Toast =
  | { message: string; type: 'error' | 'success' | 'info' }
  | { message: string; type: 'confirm'; options: ConfirmOptions };

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function GlobalToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showError = useCallback((message: string) => {
    setToast({ message, type: 'error' });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const showInfo = useCallback((message: string) => {
    setToast({ message, type: 'info' });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const showConfirm = useCallback((message: string, options: ConfirmOptions) => {
    setToast({ message, type: 'confirm', options });
  }, []);

  const handleConfirm = () => {
    if (toast?.type === 'confirm') {
      toast.options.onConfirm();
    }
    setToast(null);
  };

  const handleCancel = () => {
    if (toast?.type === 'confirm' && toast.options.onCancel) {
      toast.options.onCancel();
    }
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ showError, showSuccess, showInfo, showConfirm }}>
      {children}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-xl shadow-lg border ${
            toast.type === 'error'
              ? 'bg-danger-100 dark:bg-red-900 text-danger-700 dark:text-red-200 border-danger-700 dark:border-red-700'
              : toast.type === 'success'
                ? 'bg-success-100 dark:bg-green-900 text-success-700 dark:text-green-200 border-success-700 dark:border-green-700'
                : toast.type === 'info'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-blue-700 dark:border-blue-700'
                  : toast.type === 'confirm' && toast.options.variant === 'danger'
                    ? 'bg-danger-100 dark:bg-red-900 text-danger-700 dark:text-red-200 border-danger-700 dark:border-red-700'
                    : toast.type === 'confirm' && toast.options.variant === 'warning'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 border-yellow-700 dark:border-yellow-700'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-blue-700 dark:border-blue-700'
          }`}
        >
          <div className={toast.type === 'confirm' ? 'flex flex-col gap-3' : ''}>
            <div className="text-lg font-bold">{toast.message}</div>
            {toast.type === 'confirm' && (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-neutral-200 dark:bg-gray-700 text-neutral-700 dark:text-gray-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-gray-600 transition-colors font-semibold"
                >
                  {toast.options.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    toast.options.variant === 'danger'
                      ? 'bg-danger-700 dark:bg-red-700 text-white hover:bg-danger-800 dark:hover:bg-red-800'
                      : toast.options.variant === 'warning'
                        ? 'bg-yellow-700 dark:bg-yellow-700 text-white hover:bg-yellow-800 dark:hover:bg-yellow-800'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {toast.options.confirmText || 'Confirm'}
                </button>
              </div>
            )}
          </div>
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
