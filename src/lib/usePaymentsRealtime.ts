'use client';
import { useEffect } from 'react';
import { createClient } from './supabase';
import { useRefreshContext } from './refresh-context';

export function usePaymentsRealtime({ customerId, onPaymentsChange }: { customerId?: string, onPaymentsChange?: () => void } = {}) {
  const { triggerRefresh } = useRefreshContext();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          // customerId가 있으면 해당 거래만, 아니면 전체
          if (onPaymentsChange) {
            onPaymentsChange();
          } else {
            triggerRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerRefresh, customerId, onPaymentsChange]);
} 