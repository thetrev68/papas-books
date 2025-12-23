import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase/config';
import { fetchPayees } from '../lib/supabase/payees';

export function usePayees() {
  const { activeBookset } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payees', activeBookset?.id],
    queryFn: () => fetchPayees(activeBookset!.id),
    enabled: !!activeBookset,
  });

  useEffect(() => {
    if (!activeBookset) return;

    const channel = supabase
      .channel(`payees-changes-${activeBookset.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payees',
          filter: `bookset_id=eq.${activeBookset.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payees', activeBookset.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBookset?.id, queryClient]);

  return {
    payees: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
