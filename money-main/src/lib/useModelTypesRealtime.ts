'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Database } from '@/types/database';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useModelTypesRealtime() {
  const [modelTypes, setModelTypes] = useState<Database['public']['Tables']['models_types']['Row'][]>([]);

  useEffect(() => {
    supabase.from('models_types').select('*').then(({ data }) => setModelTypes(data ?? []));

    const channel = supabase
      .channel('models-types-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'models_types' },
        (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['models_types']['Row']>) => {
          setModelTypes((prev) => {
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as Database['public']['Tables']['models_types']['Row'];
              if (prev.some((row) => row.id === newRow.id)) return prev;
              return [...prev, newRow];
            }
            if (payload.eventType === 'UPDATE') {
              const newRow = payload.new as Database['public']['Tables']['models_types']['Row'];
              return prev.map((row) => row.id === newRow.id ? newRow : row);
            }
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Database['public']['Tables']['models_types']['Row'];
              return prev.filter((row) => row.id !== oldRow.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return [...modelTypes].sort((a, b) => {
    const modelCmp = (a.model || '').localeCompare(b.model || '', 'ko');
    if (modelCmp !== 0) return modelCmp;
    return (a.type || '').localeCompare(b.type || '', 'ko');
  });
} 