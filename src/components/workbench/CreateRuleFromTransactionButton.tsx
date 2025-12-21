import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateRule } from '../../hooks/useRules';
import { Transaction } from '../../types/database';
import { MatchType } from '../../types/rules';
import { useCategories } from '../../hooks/useCategories';

interface CreateRuleFromTransactionButtonProps {
  transaction: Transaction;
}

export default function CreateRuleFromTransactionButton({
  transaction,
}: CreateRuleFromTransactionButtonProps) {
  const { createRule } = useCreateRule();
  const { activeBookset } = useAuth();
  const { categories } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Extract keyword helper
  function extractKeyword(description: string): string {
    const words = description.trim().toLowerCase().split(/\s+/);
    return words[0] || '';
  }

  // Initial state derived from transaction
  const [formData, setFormData] = useState({
    keyword: extractKeyword(transaction.original_description),
    matchType: 'contains' as MatchType,
    caseSensitive: false,
    targetCategoryId:
      (transaction.lines as Array<{ category_id: string | null }>)?.find(() => true)?.category_id ||
      '',
    suggestedPayee: transaction.payee,
    priority: 50,
    isEnabled: true,
  });

  async function handleCreateRule() {
    if (!activeBookset) return;

    await createRule({
      booksetId: activeBookset.id,
      ...formData,
    });
    setIsFormOpen(false);
  }

  return (
    <>
      <button onClick={() => setIsFormOpen(true)}>Create Rule</button>

      {isFormOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '20px',
              maxWidth: '500px',
              width: '100%',
              borderRadius: '8px',
            }}
          >
            <h2>Create Rule from Transaction</h2>
            <p style={{ marginBottom: '10px', fontSize: '0.9em', color: '#666' }}>
              Transaction: {transaction.original_description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block' }}>Keyword:</label>
                <input
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  style={{ width: '100%', padding: '5px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block' }}>Category:</label>
                <select
                  value={formData.targetCategoryId}
                  onChange={(e) => setFormData({ ...formData, targetCategoryId: e.target.value })}
                  style={{ width: '100%', padding: '5px' }}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block' }}>Payee:</label>
                <input
                  type="text"
                  value={formData.suggestedPayee}
                  onChange={(e) => setFormData({ ...formData, suggestedPayee: e.target.value })}
                  style={{ width: '100%', padding: '5px' }}
                />
              </div>

              <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                <button onClick={handleCreateRule}>Create Rule</button>
                <button onClick={() => setIsFormOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
