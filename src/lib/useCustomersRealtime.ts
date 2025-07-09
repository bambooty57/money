import { useEffect } from 'react';
import { createClient } from './supabase';
import { useRefreshContext } from './refresh-context';

export function useCustomersRealtime({ onChange }: { onChange?: () => void } = {}) {
  const { triggerRefresh } = useRefreshContext();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          if (onChange) onChange();
          else triggerRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerRefresh, onChange]);
} 