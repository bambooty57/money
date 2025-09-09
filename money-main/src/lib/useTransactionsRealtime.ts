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
    
    // 마지막 리프레시로부터 1초가 지나지 않았으면 무시 (성능 최적화)
    if (now - lastRefreshTime.current < 1000) {
      console.log('⏳ Debounced: too frequent refresh');
      return;
    }
    
    // 기존 타임아웃이 있으면 취소
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
    }
    
    // 200ms 디바운싱 (더 빠른 반응)
    refreshTimeout.current = setTimeout(() => {
      console.log('🔄 Smart refresh triggered - Transaction realtime update');
      lastRefreshTime.current = Date.now();
      
      if (onTransactionsChange) {
        console.log('📞 Calling onTransactionsChange callback');
        onTransactionsChange();
      } else {
        console.log('📞 Calling triggerRefresh');
        triggerRefresh();
      }
    }, 200);
  }, [onTransactionsChange, triggerRefresh]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    let channel: any;
    
    // 실시간 연결 설정 시도
    const setupRealtimeConnection = async () => {
      try {
        setConnectionStatus('connecting');
        
        // 기존 채널 제거
        if (channel) {
          supabase.removeChannel(channel);
        }
        
        channel = supabase
          .channel('transactions-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'transactions' },
            (payload: any) => {
              console.log('📥 Transactions change detected:', payload.eventType, payload.new?.id || payload.old?.id);
              smartRefresh();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments' },
            (payload: any) => {
              console.log('💸 Payments change detected:', payload.eventType, payload.new?.id || payload.old?.id);
              smartRefresh();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'customers' },
            (payload: any) => {
              console.log('👤 Customers change detected:', payload.eventType, payload.new?.id || payload.old?.id);
              smartRefresh();
            }
          )
          .subscribe((status) => {
            console.log('🔗 Realtime connection status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('✅ Connected to Supabase realtime for transactions, payments, customers');
              setConnectionStatus('connected');
              setRetryCount(0); // 연결 성공 시 재시도 카운트 리셋
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.log('❌ Realtime connection failed:', status);
              setConnectionStatus('disconnected');
              // 재시도 로직 (최대 3번)
              if (retryCount < 3) {
                const retryDelay = Math.min((retryCount + 1) * 5000, 15000); // 최대 15초
                console.log(`🔄 Retrying connection in ${retryDelay}ms (attempt ${retryCount + 1}/3)`);
                retryTimeout = setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                }, retryDelay);
              }
            }
          });

        // 연결 정리 함수 반환
        return () => {
          setConnectionStatus('disconnected');
          if (retryTimeout) clearTimeout(retryTimeout);
          if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
          if (channel) {
            supabase.removeChannel(channel);
          }
        };
      } catch (error) {
        console.error('❌ Realtime connection setup error:', error);
        setConnectionStatus('disconnected');
        return () => {
          if (retryTimeout) clearTimeout(retryTimeout);
          if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
          if (channel) {
            supabase.removeChannel(channel);
          }
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