import { useEffect } from 'react';
import type { Transaction } from '../../types/database';

interface KeyboardHandlerProps {
  transactions: Transaction[];
  selectedRow: number;
  setSelectedRow: (index: number) => void;
  onEdit: (transaction: Transaction) => void;
  onSplit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onReview: (transaction: Transaction) => void;
  onCreateTransaction: () => void;
}

function KeyboardHandler({
  transactions,
  selectedRow,
  setSelectedRow,
  onEdit,
  onSplit,
  onDelete,
  onReview,
  onCreateTransaction,
}: KeyboardHandlerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!transactions.length) return;

      // J/K navigation (vim-style)
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(selectedRow + 1, transactions.length - 1);
        setSelectedRow(newIndex);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(selectedRow - 1, 0);
        setSelectedRow(newIndex);
      }

      // Space to toggle review
      if (e.key === ' ') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        if (tx) {
          onReview(tx);
        }
      }

      // Enter to edit payee
      if (e.key === 'Enter') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        if (tx) {
          onEdit(tx);
        }
      }

      // Ctrl+S to split transaction
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        if (tx) {
          onSplit(tx);
        }
      }

      // Ctrl+D to delete transaction
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        const tx = transactions[selectedRow];
        if (tx) {
          const amountStr = (tx.amount / 100).toFixed(2);
          if (
            confirm(
              `Are you sure you want to delete the transaction with "${tx.payee}" for $${amountStr}?`
            )
          ) {
            onDelete(tx);
          }
        }
      }

      // Ctrl+N to create new transaction
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        onCreateTransaction();
      }

      // Home/End for first/last row
      if (e.key === 'Home') {
        e.preventDefault();
        setSelectedRow(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedRow(transactions.length - 1);
      }

      // Page Up/Down for larger jumps
      if (e.key === 'PageUp') {
        e.preventDefault();
        const newIndex = Math.max(selectedRow - 10, 0);
        setSelectedRow(newIndex);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        const newIndex = Math.min(selectedRow + 10, transactions.length - 1);
        setSelectedRow(newIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    transactions,
    selectedRow,
    setSelectedRow,
    onEdit,
    onSplit,
    onDelete,
    onReview,
    onCreateTransaction,
  ]);

  return null; // This component doesn't render anything
}

export default KeyboardHandler;
