'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useRefreshContext } from './refresh-context';

export function usePaymentsRealtime({ customerId, onPaymentsChange }: { customerId?: string, onPaymentsChange?: () => void } = {}) {
  const { triggerRefresh } = useRefreshContext();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    // 실시간 연결 설정 시도
    const setupRealtimeConnection = async () => {
      try {
        setConnectionStatus('connecting');
        
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
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
              setRetryCount(0); // 연결 성공 시 재시도 카운트 리셋
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnectionStatus('disconnected');
              // 재시도 로직 (최대 3번)
              if (retryCount < 3) {
                retryTimeout = setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                }, (retryCount + 1) * 5000); // 5초, 10초, 15초 후 재시도
              }
            }
          });

        // 연결 정리 함수 반환
        return () => {
          setConnectionStatus('disconnected');
          if (retryTimeout) clearTimeout(retryTimeout);
          supabase.removeChannel(channel);
        };
      } catch (error) {
        setConnectionStatus('disconnected');
        return () => {
          if (retryTimeout) clearTimeout(retryTimeout);
        };
      }
    };

    const cleanup = setupRealtimeConnection();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [triggerRefresh, customerId, onPaymentsChange, retryCount]);

  // 연결 상태 반환 (디버깅용)
  return { connectionStatus, retryCount };
} 