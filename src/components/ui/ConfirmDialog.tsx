import Modal from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps) {
  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-danger-600 hover:bg-danger-700 text-white'
      : 'bg-brand-600 hover:bg-brand-700 text-white';

  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <div className="space-y-6">
        <p className="text-neutral-700 dark:text-gray-300 text-lg">{message}</p>

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white dark:bg-gray-700 border-2 border-neutral-300 dark:border-gray-600 text-neutral-700 dark:text-gray-200 font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-gray-600"
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 font-bold rounded-xl shadow ${confirmButtonClass}`}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
