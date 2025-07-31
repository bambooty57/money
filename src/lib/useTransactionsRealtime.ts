'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { useRefreshContext } from './refresh-context';

export function useTransactionsRealtime({ 
  customerId, 
  onTransactionsChange 
}: { 
  customerId?: string, 
  onTransactionsChange?: () => void 
} = {}) {
  const { triggerRefresh } = useRefreshContext();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  
  // 🚀 성능 최적화: 디바운싱을 위한 ref
  const lastRefreshTime = useRef<number>(0);
  const refreshTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // 🚀 성능 최적화: 스마트 리프레시 함수
  const smartRefresh = useCallback(() => {
    const now = Date.now();
    
    // 마지막 리프레시로부터 2초가 지나지 않았으면 무시
    if (now - lastRefreshTime.current < 2000) {
      return;
    }
    
    // 기존 타임아웃이 있으면 취소
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
    }
    
    // 500ms 디바운싱
    refreshTimeout.current = setTimeout(() => {
      console.log('🔄 Smart refresh triggered');
      lastRefreshTime.current = Date.now();
      
      if (onTransactionsChange) {
        onTransactionsChange();
      } else {
        triggerRefresh();
      }
    }, 500);
  }, [onTransactionsChange, triggerRefresh]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    // 실시간 연결 설정 시도
    const setupRealtimeConnection = async () => {
      try {
        setConnectionStatus('connecting');
        
        const channel = supabase
          .channel('transactions-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'transactions' },
            (payload) => {
              console.log('🔄 Realtime transaction change:', payload);
              smartRefresh();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments' },
            (payload) => {
              console.log('🔄 Realtime payment change:', payload);
              smartRefresh();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'customers' },
            (payload) => {
              console.log('🔄 Realtime customer change:', payload);
              smartRefresh();
            }
          )
          .subscribe((status) => {
            console.log('📡 Realtime connection status:', status);
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
              setRetryCount(0); // 연결 성공 시 재시도 카운트 리셋
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnectionStatus('disconnected');
              console.warn('⚠️ Realtime connection failed, falling back to manual refresh');
              
              // 재시도 로직 (최대 3번)
              if (retryCount < 3) {
                console.log(`🔄 Retrying connection in ${(retryCount + 1) * 5} seconds...`);
                retryTimeout = setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                }, (retryCount + 1) * 5000); // 5초, 10초, 15초 후 재시도
              }
            }
          });

        // 연결 정리 함수 반환
        return () => {
          console.log('🧹 Cleaning up realtime connection');
          setConnectionStatus('disconnected');
          if (retryTimeout) clearTimeout(retryTimeout);
          if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('❌ Failed to setup realtime connection:', error);
        setConnectionStatus('disconnected');
        return () => {
          if (retryTimeout) clearTimeout(retryTimeout);
          if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
        };
      }
    };

    const cleanup = setupRealtimeConnection();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [smartRefresh, customerId, retryCount]);

  // 연결 상태 반환 (디버깅용)
  return { connectionStatus, retryCount };
} 