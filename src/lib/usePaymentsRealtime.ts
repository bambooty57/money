'use client';
import { useEffect } from 'react';
import { createClient } from './supabase';
import { useRefreshContext } from './refresh-context';

export function usePaymentsRealtime() {
  const { triggerRefresh } = useRefreshContext();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => triggerRefresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerRefresh]);
} 