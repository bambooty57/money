'use client';
import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useRefreshContext } from './refresh-context';

export function useCustomersRealtime({ onChange }: { onChange?: () => void } = {}) {
  const { triggerRefresh } = useRefreshContext();
  const lastRefreshTime = useRef<number>(0);
  const refreshTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`customers-changes-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          const now = Date.now();
          
          // 🚀 성능 최적화: 디바운싱 적용
          // 마지막 새로고침으로부터 2초 이내면 무시
          if (now - lastRefreshTime.current < 2000) {
            return;
          }
          
          // 기존 타임아웃 취소
          if (refreshTimeout.current) {
            clearTimeout(refreshTimeout.current);
          }
          
          // 500ms 후에 새로고침 실행 (디바운싱)
          refreshTimeout.current = setTimeout(() => {
            lastRefreshTime.current = Date.now();
            if (onChange) {
              onChange();
            } else {
              triggerRefresh();
            }
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
      supabase.removeChannel(channel);
    };
  }, [triggerRefresh, onChange]);
} 