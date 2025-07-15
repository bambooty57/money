"use client";
import { useEffect } from 'react';
import { supabase } from './supabase';
import { useRefreshContext } from './refresh-context';

export function useTransactionsRealtime({ customerId, onChange }: { customerId?: string, onChange?: () => void } = {}) {
  const { triggerRefresh } = useRefreshContext();

  useEffect(() => {
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          if (onChange) onChange();
          else triggerRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerRefresh, onChange, customerId]);
} 