import { useEffect } from 'react';
import { supabase } from './supabase';
import { useRefreshContext } from './refresh-context';

export function useModelTypesRealtime({ onChange }: { onChange?: () => void } = {}) {
  const { triggerRefresh } = useRefreshContext();

  useEffect(() => {
    const channel = supabase
      .channel('models-types-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'models_types' },
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