"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // 화면 밖 렌더링할 아이템 수
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // 화면에 보여질 아이템들 계산 (메모이제이션)
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );
    const visibleStartIndex = Math.max(0, startIndex - overscan);

    return {
      startIndex: visibleStartIndex,
      endIndex,
      items: items.slice(visibleStartIndex, endIndex),
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items]);

  // 스크롤 핸들러 (성능 최적화: useCallback 사용)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // 전체 컨테이너 높이
  const totalHeight = items.length * itemHeight;

  // 상단 공백 높이
  const offsetY = visibleItems.startIndex * itemHeight;

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.items.map((item, index) => (
            <div
              key={visibleItems.startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleItems.startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 성능 측정 컴포넌트
export function PerformanceMonitor({ children }: { children: React.ReactNode }) {
  const [renderTime, setRenderTime] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();
  });

  useEffect(() => {
    const endTime = performance.now();
    setRenderTime(endTime - startTimeRef.current);

    // 메모리 사용량 측정 (브라우저가 지원하는 경우)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      setMemoryUsage(memory.usedJSHeapSize / 1024 / 1024); // MB 단위
    }
  });

  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="relative">
        {children}
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50">
          <div>Render: {renderTime.toFixed(2)}ms</div>
          {memoryUsage > 0 && <div>Memory: {memoryUsage.toFixed(1)}MB</div>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 