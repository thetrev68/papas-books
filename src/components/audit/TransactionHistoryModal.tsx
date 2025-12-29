import { Transaction } from '../../types/database';
import AuditHistoryModal from './AuditHistoryModal';

interface TransactionHistoryModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionHistoryModal({
  transaction,
  onClose,
}: TransactionHistoryModalProps) {
  // Get a display name for the transaction
  const entityName = transaction.payee || transaction.original_description || 'Transaction';

  return (
    <AuditHistoryModal
      entityType="transaction"
      entityId={transaction.id}
      entityName={entityName}
      isOpen={true}
      onClose={onClose}
    />
  );
}
