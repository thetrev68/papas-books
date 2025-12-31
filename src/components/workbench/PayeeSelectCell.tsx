import { useState, useEffect, useRef, memo } from 'react';
import type { Payee } from '../../types/database';
import { useToast } from '../GlobalToastProvider';

interface PayeeSelectCellProps {
  value: string;
  payees: Payee[];
  onSave: (newValue: string) => void;
  onCancel: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  onCreatePayee?: (name: string) => void;
}

const PayeeSelectCell = memo(function PayeeSelectCell({
  value,
  payees,
  onSave,
  onCancel,
  isEditing,
  setIsEditing,
  onCreatePayee,
}: PayeeSelectCellProps) {
  const { showConfirm } = useToast();
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `payees-list-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    // If value hasn't changed, just close
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    if (!editValue.trim()) {
      onSave('');
      setIsEditing(false);
      return;
    }

    // Check if payee exists
    const exists = payees.some((p) => p.name.toLowerCase() === editValue.toLowerCase());

    if (!exists && onCreatePayee) {
      showConfirm(`Payee "${editValue}" does not exist. Do you want to add it?`, {
        onConfirm: () => {
          // Yes: Update transaction AND open create modal
          onSave(editValue);
          onCreatePayee(editValue);
          setIsEditing(false);
        },
        onCancel: () => {
          // No: Return to editing (don't save, don't close)
          // Focus back on input if lost
          setTimeout(() => inputRef.current?.focus(), 0);
        },
        confirmText: 'Add Payee',
        cancelText: 'Cancel',
        variant: 'info',
      });
    } else {
      // Exists or no creation handler: Just save
      onSave(editValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    onCancel();
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleClick = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <>
        <input
          ref={inputRef}
          type="text"
          list={listId}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full p-1 text-sm border-2 border-brand-500 rounded bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900"
        />
        <datalist id={listId}>
          {payees.map((payee) => (
            <option key={payee.id} value={payee.name} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer px-1 py-0.5 rounded inline-block w-full min-h-[1.5em] hover:bg-neutral-100 dark:hover:bg-gray-700 ${
        !value
          ? 'text-neutral-400 dark:text-gray-500 italic'
          : 'text-neutral-900 dark:text-gray-100'
      }`}
    >
      {value || 'Select Payee...'}
    </span>
  );
});

export default PayeeSelectCell;
