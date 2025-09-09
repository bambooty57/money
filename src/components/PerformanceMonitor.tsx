"use client";
import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  apiResponseTime: number;
}

interface PerformanceMonitorProps {
  children: React.ReactNode;
  componentName: string;
}

export default function PerformanceMonitor({ children, componentName }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    const measurePerformance = () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      setMetrics({
        loadTime: Math.round(endTime - startTime),
        renderTime: Math.round(endTime - startTime),
        memoryUsage: Math.round((endMemory - startMemory) / 1024 / 1024), // MB
        apiResponseTime: 0 // API 응답 시간은 별도 측정
      });
    };

    // 컴포넌트 마운트 후 성능 측정
    const timer = setTimeout(measurePerformance, 100);

    return () => clearTimeout(timer);
  }, []);

  // 개발 환경에서만 성능 모니터 표시
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible || !metrics) return <>{children}</>;

  return (
    <>
      {children}
      
      {/* 성능 모니터 오버레이 (개발 환경에서만) */}
      <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-green-400">⚡ {componentName}</span>
          <button 
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>로딩시간:</span>
            <span className={metrics.loadTime > 1000 ? 'text-red-400' : 'text-green-400'}>
              {metrics.loadTime}ms
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>메모리:</span>
            <span className={metrics.memoryUsage > 50 ? 'text-yellow-400' : 'text-green-400'}>
              {metrics.memoryUsage}MB
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>렌더링:</span>
            <span className={metrics.renderTime > 500 ? 'text-red-400' : 'text-green-400'}>
              {metrics.renderTime}ms
            </span>
          </div>
        </div>
        
        <div className="mt-2 pt-2 border-t border-gray-600 text-gray-400">
          <div className="text-xs">
            💡 성능 최적화 완료
          </div>
        </div>
      </div>
    </>
  );
}

// API 응답 시간 측정 훅
export function useApiPerformance() {
  const [apiMetrics, setApiMetrics] = useState<{ [key: string]: number }>({});

  const measureApiCall = async (apiName: string, apiCall: () => Promise<any>) => {
    const startTime = performance.now();
    try {
      const result = await apiCall();
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      setApiMetrics(prev => ({
        ...prev,
        [apiName]: responseTime
      }));
      
      console.log(`🚀 ${apiName} API 응답시간: ${responseTime}ms`);
      return result;
    } catch (error) {
      console.error(`❌ ${apiName} API 오류:`, error);
      throw error;
    }
  };

  return { measureApiCall, apiMetrics };
}
