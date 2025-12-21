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
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem',
            backgroundColor: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: toast.type === 'error' ? '#991b1b' : '#166534',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 9999,
          }}
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
