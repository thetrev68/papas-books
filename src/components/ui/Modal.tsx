import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

export default function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeClasses[size]} bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-lg max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-gray-700 p-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Close"
            type="button"
          >
            &times;
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
