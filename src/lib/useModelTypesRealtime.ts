'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Database } from '@/types/database';

export function useModelTypesRealtime() {
  const [modelTypes, setModelTypes] = useState<Database['public']['Tables']['models_types']['Row'][]>([]);

  useEffect(() => {
    // 최초 데이터 fetch
    supabase.from('models_types').select('*').then(({ data }) => setModelTypes(data ?? []));

    // 실시간 구독
    const channel = supabase
      .channel('models-types-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'models_types' },
        (payload) => {
          setModelTypes((prev) => {
            if (payload.eventType === 'INSERT') {
              // 중복 방지
              if (prev.some((row) => row.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((row) => row.id === payload.new.id ? payload.new : row);
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((row) => row.id !== payload.old.id);
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

  return modelTypes;
} 