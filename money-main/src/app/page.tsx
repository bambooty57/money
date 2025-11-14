"use client";
import { useEffect, useState, useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PointElement
} from 'chart.js';
import jsPDF from 'jspdf';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRefreshContext } from '@/lib/refresh-context';
import { Pagination } from '@/components/ui/pagination';
import ScrollToTop from '@/components/ui/scroll-to-top';
import { supabase } from '@/lib/supabase';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  ChartDataLabels
);

interface DashboardData {
  today: string;
  totalUnpaid: number;
  agingAnalysis: Array<{
    created_at: string;
    amount: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    transactions: Array<{
      amount: number;
      status: string;
      payments?: Array<{ amount: number }>;
    }>;
    customer_type_multi?: string[];
    customer_type?: string;
    address_road?: string;
    address_jibun?: string;
    zipcode?: string;
    photos?: Array<{ url: string }>;
    unpaidAmount: number;
  }>;
  monthlyStats: Array<{
    month: string;
    total: number;
  }>;
  monthlySalesStats: Array<{
    month: string;
    total: number;
  }>;
  typeStats: Array<{
    type: string;
    total: number;
  }>;
  dueThisMonth: Array<{
    id: string;
    customer_id: string;
    customer_name?: string;
    model?: string;
    model_type?: string;
    amount?: number;
    paid_amount?: number;
    unpaid_amount?: number;
    paid_ratio?: number;
    due_date?: string;
    status: string;
    days_left?: number;
  }>;
  dueThisMonthSummary: {
    count: number;
    totalAmount: number;
    totalUnpaid: number;
    avgPaidRatio: number;
  };
  overdueTxs: Array<{
    id: string;
    customer_id: string;
    customer_name?: string;
    model?: string;
    model_type?: string;
    amount?: number;
    paid_amount?: number;
    unpaid_amount?: number;
    paid_ratio?: number;
    due_date?: string;
    status: string;
    overdue_days?: number;
  }>;
  overdueTxsSummary: {
    count: number;
    totalAmount: number;
    totalUnpaid: number;
    avgOverdueDays: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  // 갤러리 모달 상태
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryBackdropRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { refreshKey } = useRefreshContext();
  // 지급예정 거래건 페이지네이션 상태 (최상단으로 이동)
  const [duePage, setDuePage] = useState(1);
  const duePageSize = 15;
  // 지급예정일이 지난 거래건 페이지네이션 상태
  const [overduePage, setOverduePage] = useState(1);
  const overduePageSize = 15;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        console.log('🔒 세션이 없습니다. 로그인 페이지로 이동합니다.');
        router.replace('/login');
      } else {
        console.log('✅ 로그인된 사용자:', session.user?.email);
      }
    });
  }, [router]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const dashboardData = await response.json();
        
        // API 응답에 error 필드가 있으면 오류 처리
        if (dashboardData.error) {
          console.error('Dashboard API error:', dashboardData.error);
          return;
        }
        
        setData(dashboardData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // 기본값으로 빈 데이터 설정하여 UI 깨짐 방지
        setData({
          today: new Date().toISOString().slice(0, 10),
          totalUnpaid: 0,
          agingAnalysis: [],
          topCustomers: [],
          monthlyStats: [],
          monthlySalesStats: [],
          typeStats: [],
          dueThisMonth: [],
          dueThisMonthSummary: { count: 0, totalAmount: 0, totalUnpaid: 0, avgPaidRatio: 0 },
          overdueTxs: [],
          overdueTxsSummary: { count: 0, totalAmount: 0, totalUnpaid: 0, avgOverdueDays: 0 }
        });
      }
    }
    fetchDashboard();
  }, [refreshKey]);

  // 실시간 데이터 동기화 설정 (최적화된 버전)
  useEffect(() => {
    const channels: any[] = [];
    let refreshTimeout: NodeJS.Timeout;
    
    // 데이터 새로고침 함수 (디바운싱 적용)
    const refreshData = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(async () => {
        try {
          const response = await fetch('/api/dashboard');
          if (response.ok) {
            const dashboardData = await response.json();
            if (!dashboardData.error) {
              setData(dashboardData);
              console.log('✅ 실시간 데이터 업데이트 완료');
            }
          }
        } catch (error) {
          console.error('❌ 실시간 데이터 업데이트 실패:', error);
        }
      }, 1000); // 1초 디바운싱
    };
    
    // 거래 데이터 변경 감지
    const transactionsChannel = supabase
      .channel('dashboard-transactions')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'transactions' 
        }, 
        (payload) => {
          console.log('🔄 거래 데이터 변경 감지:', payload.eventType);
          setRealtimeStatus('connected');
          refreshData(); // 전체 페이지 리로드 대신 데이터만 새로고침
        }
      )
      .subscribe((status: string) => {
        console.log('📡 거래 데이터 구독 상태:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ 거래 데이터 실시간 구독 성공');
          setRealtimeStatus('connected');
        }
      });
    
    // 결제 데이터 변경 감지
    const paymentsChannel = supabase
      .channel('dashboard-payments')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'payments' 
        }, 
        (payload) => {
          console.log('🔄 결제 데이터 변경 감지:', payload.eventType);
          setRealtimeStatus('connected');
          refreshData(); // 전체 페이지 리로드 대신 데이터만 새로고침
        }
      )
      .subscribe((status: string) => {
        console.log('📡 결제 데이터 구독 상태:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ 결제 데이터 실시간 구독 성공');
          setRealtimeStatus('connected');
        }
      });
    
    // 고객 데이터 변경 감지
    const customersChannel = supabase
      .channel('dashboard-customers')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'customers' 
        }, 
        (payload) => {
          console.log('🔄 고객 데이터 변경 감지:', payload.eventType);
          setRealtimeStatus('connected');
          refreshData(); // 전체 페이지 리로드 대신 데이터만 새로고침
        }
      )
      .subscribe((status: string) => {
        console.log('📡 고객 데이터 구독 상태:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ 고객 데이터 실시간 구독 성공');
          setRealtimeStatus('connected');
        }
      });
    
    channels.push(transactionsChannel, paymentsChannel, customersChannel);
    
    // 연결 상태 모니터링
    const statusInterval = setInterval(() => {
      const allConnected = channels.every(channel => channel.state === 'joined');
      if (!allConnected && realtimeStatus === 'connected') {
        setRealtimeStatus('disconnected');
      }
    }, 5000);
    
    // 정리 함수
    return () => {
      clearInterval(statusInterval);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [realtimeStatus]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 갤러리 모달 닫기 핸들러
  const closeGallery = () => setGalleryOpen(false);
  // 키보드 ESC 닫기
  useEffect(() => {
    if (!galleryOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft') setGalleryIndex(idx => Math.max(0, idx - 1));
      if (e.key === 'ArrowRight') setGalleryIndex(idx => Math.min(galleryPhotos.length - 1, idx + 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [galleryOpen, galleryPhotos.length]);
  // 바깥 클릭 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === galleryBackdropRef.current) closeGallery();
  };

  // 스켈레톤 UI 컴포넌트
  const SkeletonCard = () => (
    <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gray-300 rounded"></div>
        <div className="h-6 bg-gray-300 rounded w-32"></div>
      </div>
      <div className="h-8 bg-gray-300 rounded w-24"></div>
    </div>
  );

  const SkeletonTable = () => (
    <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200 animate-pulse">
      <div className="h-8 bg-gray-300 rounded w-48 mb-6"></div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex space-x-4">
            <div className="h-4 bg-gray-300 rounded flex-1"></div>
            <div className="h-4 bg-gray-300 rounded flex-1"></div>
            <div className="h-4 bg-gray-300 rounded flex-1"></div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
  );

  // 로딩 상태 개선 - 스켈레톤 UI
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-screen-2xl mx-auto px-8 py-8">
          {/* 헤더 스켈레톤 */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-gray-200 animate-pulse">
            <div className="h-10 bg-gray-300 rounded w-64 mb-4"></div>
            <div className="h-6 bg-gray-300 rounded w-32"></div>
          </div>

          {/* KPI 카드들 스켈레톤 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>

          {/* 차트 스켈레톤 */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-gray-200 mb-8 animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-48 mb-6"></div>
            <div className="h-80 bg-gray-200 rounded"></div>
          </div>

          {/* 테이블 스켈레톤 */}
          <SkeletonTable />
        </div>
      </div>
    );
  }

  // 아래 변수들은 data가 null이 아닐 때만 정의
  const stackColors = [
    'rgba(53, 162, 235, 0.7)', // 파랑
    'rgba(75, 192, 192, 0.7)', // 초록
    'rgba(153, 102, 255, 0.7)', // 보라
    'rgba(255, 206, 86, 0.7)', // 노랑
    'rgba(255, 99, 132, 0.7)', // 빨강
    'rgba(255, 159, 64, 0.7)', // 주황
  ];
  const stackBorderColors = [
    'rgba(53, 162, 235, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(255, 159, 64, 1)',
  ];
  const maxUnpaid = (data.topCustomers || []).length > 0 ? Math.max(...(data.topCustomers || []).map(c => c.unpaidAmount || 0)) : 0;
  const yAxisMax = Math.ceil(maxUnpaid / 10000000) * 10000000 + 10000000; // 1천만 단위 올림

  // 1. Top 10 고객만 추출 (안전 가드 추가)
  const top10 = (data.topCustomers || []).slice(0, 10);
  // 2. X축 라벨: 고객명(윗줄) + 총 미수금(아랫줄)
  const customerLabels = top10.map(c => `${c.name || '이름없음'}\n₩${(c.unpaidAmount || 0).toLocaleString()}`);
  // 3. 각 고객별 건별 미수금 스택 데이터셋 생성 (안전 가드 추가)
  const maxTxCount = top10.length > 0 ? Math.max(...top10.map(c => (c.transactions || []).filter(tx => tx.status === 'unpaid').length)) : 0;
  const stackDatasets = maxTxCount > 0 ? Array.from({ length: maxTxCount }).map((_, stackIdx) => ({
    label: `${stackIdx + 1}번째 건`,
    data: top10.map(c => {
      const unpaidTxs = (c.transactions || []).filter((tx: any) => tx.status === 'unpaid');
      const tx = unpaidTxs[stackIdx];
      if (!tx) return 0;
      const paid = (tx.payments || []).reduce((sum: any, p: any) => sum + (p.amount || 0), 0);
      return Math.max((tx.amount || 0) - paid, 0);
    }),
    backgroundColor: stackColors[stackIdx % stackColors.length],
    borderColor: stackBorderColors[stackIdx % stackBorderColors.length],
    borderWidth: 2,
    datalabels: {
      formatter: (value: any) => value > 0 ? `₩${Number(value).toLocaleString('ko-KR')}` : '',
      color: '#fff',
      font: { weight: 700, size: 14 },
      display: true,
      anchor: 'center' as const,
      align: 'center' as const,
      clip: false,
    }
  })) : [];

  // DashboardPage 내부 (안전 가드 추가)
  const dueTxs = data.dueThisMonth || [];
  const dueTotalPages = Math.ceil(dueTxs.length / duePageSize);
  const dueTxsPage = dueTxs.slice((duePage - 1) * duePageSize, duePage * duePageSize);

  const overdueTxs = data.overdueTxs || [];
  const overdueTotalPages = Math.ceil(overdueTxs.length / overduePageSize);
  const overdueTxsPage = overdueTxs.slice((overduePage - 1) * overduePageSize, overduePage * overduePageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 갤러리 모달 */}
      {galleryOpen && (
        <div ref={galleryBackdropRef} onClick={handleBackdropClick} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="relative bg-white rounded-lg shadow-2xl p-4 md:p-8 flex flex-col items-center max-w-full max-h-full">
            <button onClick={closeGallery} className="absolute top-2 right-2 text-3xl text-gray-700 hover:text-red-500 font-bold" aria-label="닫기">×</button>
            <div className="flex items-center gap-6">
              <button
                onClick={() => setGalleryIndex(idx => Math.max(0, idx - 1))}
                disabled={galleryIndex === 0}
                className="text-4xl px-2 py-1 rounded-lg bg-gray-100 hover:bg-blue-100 disabled:opacity-30"
                aria-label="이전 사진"
              >
                ◀️
              </button>
              <img
                src={galleryPhotos[galleryIndex]}
                alt={`고객사진 ${galleryIndex + 1}`}
                className="max-w-[80vw] max-h-[70vh] rounded-lg border-4 border-blue-200 shadow-lg bg-white object-contain"
              />
              <button
                onClick={() => setGalleryIndex(idx => Math.min(galleryPhotos.length - 1, idx + 1))}
                disabled={galleryIndex === galleryPhotos.length - 1}
                className="text-4xl px-2 py-1 rounded-lg bg-gray-100 hover:bg-blue-100 disabled:opacity-30"
                aria-label="다음 사진"
              >
                ▶️
              </button>
            </div>
            <div className="mt-4 text-lg font-semibold text-gray-700">
              {galleryIndex + 1} / {galleryPhotos.length}
            </div>
          </div>
        </div>
      )}
      {/* 맨위로 가기 버튼 */}
      <ScrollToTop />
      {/* 시니어 친화적 대시보드 전체 래퍼 */}
      <div className="max-w-screen-2xl mx-auto px-8 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3 mb-0">
              📊 관리 대시보드
            </h1>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${
                  realtimeStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  realtimeStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`}></div>
                <span className={`text-lg font-bold ${
                  realtimeStatus === 'connected' ? 'text-green-600' :
                  realtimeStatus === 'connecting' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {realtimeStatus === 'connected' ? '🟢 실시간 연결됨' :
                   realtimeStatus === 'connecting' ? '🟡 연결 중...' :
                   '🔴 연결 끊김'}
                </span>
              </div>
              <div className="text-xl text-gray-600 font-semibold flex items-center gap-2">
                📅 오늘: <span className="text-blue-600 font-bold">
                  {isClient ? data.today : new Date().toISOString().slice(0, 10)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 카드들 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-blue-50 p-4 md:p-8 rounded-lg shadow-lg border-2 border-blue-200">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-2xl md:text-4xl">💰</span>
              <h3 className="text-lg md:text-xl font-bold text-blue-700">총 미수금</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-blue-600">
              {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.totalUnpaid)}
            </p>
          </div>
          <div className="bg-green-50 p-4 md:p-8 rounded-lg shadow-lg border-2 border-green-200">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-2xl md:text-4xl">👥</span>
              <h3 className="text-lg md:text-xl font-bold text-green-700">상위 고객 (10명)</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-green-600">₩{data.topCustomers.slice(0, 10).reduce((sum, c) => sum + (c.unpaidAmount || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-yellow-50 p-4 md:p-8 rounded-lg shadow-lg border-2 border-yellow-200">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-2xl md:text-4xl">📅</span>
              <h3 className="text-lg md:text-xl font-bold text-yellow-700">이번달 예정</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-yellow-600">{(data as any).dueThisMonth?.length || 0}건</p>
            {/* 총 미수금액 표시 */}
            <p className="text-base md:text-xl font-bold text-yellow-700 mt-2">
              {((data as any).dueThisMonth && (data as any).dueThisMonth.length > 0)
                ? '₩' + (data as any).dueThisMonth.reduce((sum: number, tx: any) => sum + (tx.unpaid_amount || 0), 0).toLocaleString()
                : '₩0'}
            </p>
          </div>
          <div className="bg-red-50 p-4 md:p-8 rounded-lg shadow-lg border-2 border-red-200">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="text-2xl md:text-4xl">⚠️</span>
              <h3 className="text-lg md:text-xl font-bold text-red-700">연체 거래</h3>
            </div>
            <p className="text-xl md:text-3xl font-bold text-red-600">{(data as any).overdueTxs?.length || 0}건</p>
            {/* 총 미수금액 표시 */}
            <p className="text-base md:text-xl font-bold text-red-700 mt-2">
              {((data as any).overdueTxs && (data as any).overdueTxs.length > 0)
                ? '₩' + (data as any).overdueTxs.reduce((sum: number, tx: any) => sum + (tx.unpaid_amount || 0), 0).toLocaleString()
                : '₩0'}
            </p>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="bg-white p-4 md:p-8 rounded-lg shadow-lg border-2 border-gray-200">
            <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-800 flex items-center gap-2">
              👑 상위 미수금 고객
            </h3>
            {/* 총 미수금액 표시 */}
            <div className="mb-4 text-lg md:text-2xl font-extrabold text-blue-700 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>💰 총 미수금액:</span>
              <span className="text-xl md:text-3xl text-red-600">₩{data.topCustomers.reduce((sum, c) => sum + (c.unpaidAmount || 0), 0).toLocaleString()}</span>
            </div>
            {top10.length > 0 ? (
            <div className="w-full overflow-x-auto" style={{ height: '500px', minHeight: '400px', maxHeight: '600px' }}>
            <Bar
              data={{
                labels: customerLabels,
                datasets: stackDatasets
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                  duration: 800, // 애니메이션 시간 단축
                  easing: 'easeInOutQuart'
                },
                plugins: {
                  legend: { display: false },
                  datalabels: {
                    display: true,
                    color: '#fff',
                    font: { weight: 'bold', size: 14 }, // 폰트 크기 축소
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value, context) {
                      // 값이 큰 경우에만 표시하여 성능 향상
                      return value > 100000 ? `₩${Number(value).toLocaleString('ko-KR')}` : '';
                    },
                  },
                },
                scales: {
                  x: {
                    stacked: true,
                    ticks: {
                      font: { size: 14 }, // 폰트 크기 축소
                      maxRotation: 45, // 회전 각도 제한
                      callback: function(value, index) {
                        return customerLabels[index] ? customerLabels[index].split('\n') : value;
                      }
                    },
                  },
                  y: {
                    stacked: true,
                    max: yAxisMax,
                    ticks: {
                      font: { size: 12 }, // 폰트 크기 축소
                      callback: function(tickValue, _index, _ticks) {
                        return typeof tickValue === 'number' ? `₩${tickValue.toLocaleString('ko-KR')}` : tickValue;
                      }
                    }
                  }
                },
                // 성능 최적화 옵션
                elements: {
                  bar: {
                    borderWidth: 1 // 테두리 두께 축소
                  }
                }
              }}
              plugins={[ChartDataLabels]}
            />
            </div>
            ) : (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
                <p className="text-xl md:text-2xl font-bold text-yellow-700 mb-2">⚠️ 미수금이 있는 고객이 없습니다</p>
                <p className="text-lg text-yellow-600">거래 데이터를 확인해주세요.</p>
              </div>
            )}
          </div>

        {/* 상위 고객 상세 테이블 */}
        <div className="bg-white p-4 md:p-8 rounded-lg shadow-lg border-2 border-gray-200 mb-8">
          <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-800 flex items-center gap-2">
            📋 상위 고객 상세 정보
          </h3>
          {data.topCustomers && data.topCustomers.length > 0 ? (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm md:text-lg border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-blue-100 border-b-2 border-blue-200">
                  <th className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 font-bold text-gray-800">👤 이름</th>
                  <th className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 font-bold text-gray-800">🏷️ 고객유형</th>
                  <th className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 font-bold text-gray-800">📍 주소</th>
                  <th className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 font-bold text-gray-800">📷 사진</th>
                  <th className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 font-bold text-gray-800">💰 미수금액</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-blue-50 border-b border-gray-200">
                    <td className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 font-semibold">{customer.name}</td>
                    <td className="border border-gray-300 px-2 md:px-6 py-2 md:py-4">{Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}</td>
                    <td className="border border-gray-300 px-2 md:px-6 py-2 md:py-4">
                      <div className="space-y-1">
                        {customer.address_road && (
                          <div>
                            <span className="text-sm text-gray-500">🏢 도로명: </span>
                            <a 
                              href={`https://map.kakao.com/link/search/${encodeURIComponent(customer.address_road)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer transition-colors duration-200"
                              title="카카오맵에서 보기"
                            >
                              {customer.address_road}
                            </a>
                          </div>
                        )}
                        {customer.address_jibun && (
                          <div>
                            <span className="text-sm text-gray-500">🏠 지번: </span>
                            <a 
                              href={`https://map.kakao.com/link/search/${encodeURIComponent(customer.address_jibun)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer transition-colors duration-200"
                              title="카카오맵에서 보기"
                            >
                              {customer.address_jibun}
                            </a>
                          </div>
                        )}
                        {customer.zipcode && (
                          <div>
                            <span className="text-sm text-gray-500">📮 우편번호: </span>
                            <span className="font-semibold">{customer.zipcode}</span>
                          </div>
                        )}
                        {!customer.address_road && !customer.address_jibun && !customer.zipcode && (
                          <span className="text-gray-400 text-lg">-</span>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 md:px-6 py-2 md:py-4">
                      {customer.photos && customer.photos.length > 0 ? (
                        <div className="flex space-x-1 md:space-x-2">
                          {customer.photos.slice(0, 3).map((photo: any, idx: number) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setGalleryPhotos(customer.photos.map((p: any) => p.url));
                                setGalleryIndex(idx);
                                setGalleryOpen(true);
                              }}
                              className="block focus:outline-none hover:opacity-80 transition-opacity duration-200"
                              title="클릭하면 사진 갤러리로 볼 수 있습니다"
                            >
                              <img
                                src={photo.url}
                                alt="고객사진"
                                className="w-8 md:w-12 h-8 md:h-12 rounded-lg object-cover border-2 border-gray-300 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                              />
                            </button>
                          ))}
                          {customer.photos.length > 3 && (
                            <div className="w-8 md:w-12 h-8 md:h-12 rounded-lg border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
                              <span className="text-xs text-gray-600 font-bold">+{customer.photos.length - 3}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm md:text-lg">-</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 md:px-6 py-2 md:py-4 text-right font-bold text-red-600 text-base md:text-xl">{customer.unpaidAmount.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
              <p className="text-xl md:text-2xl font-bold text-yellow-700 mb-2">⚠️ 미수금이 있는 고객이 없습니다</p>
              <p className="text-lg text-yellow-600">거래 데이터를 확인해주세요.</p>
            </div>
          )}
        </div>

        {/* 거래 상태별 합계 차트 - 임시 비활성화 */}
        {/* {data.statusStats && data.statusStats.length > 0 && (
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-200 mb-8">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              📊 거래 상태별 합계
            </h3>
            <Bar data={{
              labels: data.statusStats.map((s: any) => s.status),
              datasets: [{
                label: '합계',
                data: data.statusStats.map((s: any) => s.total),
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2
              }]
            }} 
            options={{
              responsive: true,
              plugins: {
                legend: {
                  labels: {
                    font: {
                      size: 16,
                      weight: 'bold'
                    }
                  }
                }
              },
              scales: {
                y: {
                  min: 0,
                  ticks: {
                    font: { size: 14 }
                  }
                },
                x: {
                  ticks: {
                    font: { size: 14 }
                  }
                }
              }
            }} />
          </div>
        )} */}

        {/* 뷰 모드 토글 */}
        <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-gray-200 mb-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            👁️ 거래내역 보기 방식 선택
          </h3>
          <div className="flex gap-4">
            <button
              className={`px-8 py-4 rounded-lg text-lg font-bold transition-all duration-200 ${
                viewMode === 'table' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setViewMode('table')}
            >
              📋 그리드(표) 보기
            </button>
            <button
              className={`px-8 py-4 rounded-lg text-lg font-bold transition-all duration-200 ${
                viewMode === 'card' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setViewMode('card')}
            >
              🃏 카드형 보기
            </button>
          </div>
        </div>

        {/* 이번달 지급예정 거래건 */}
        <div className="bg-blue-50 p-8 rounded-lg shadow-lg border-2 border-blue-200 mb-8">
          <h3 className="text-2xl font-bold mb-6 text-blue-800 flex items-center gap-2">
            📅 이번달 지급예정 거래건
          </h3>
          {viewMode === 'table' ? (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-lg border-collapse bg-white rounded-lg">
                <thead>
                  <tr className="bg-blue-100 border-b-2 border-blue-200">
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">👤 고객명</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">🚜 기종</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">📱 모델</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">💰 전체금액</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">💳 입금액</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">💸 미수금</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">📊 입금율</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">📅 지급예정일</th>
                    <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">⏰ 남은일수</th>
                  </tr>
                </thead>
                <tbody>
                  {dueTxsPage.map((tx: any) => (
                    <tr key={tx.id} className="border-b hover:bg-blue-50">
                      <td className="border border-gray-300 px-4 py-4 font-semibold">{tx.customer_name}</td>
                      <td className="border border-gray-300 px-4 py-4">{tx.model}</td>
                      <td className="border border-gray-300 px-4 py-4">{tx.model_type}</td>
                      <td className="border border-gray-300 px-4 py-4 text-right font-bold">{tx.amount?.toLocaleString()}원</td>
                      <td className="border border-gray-300 px-4 py-4 text-right font-bold text-blue-600">{tx.paid_amount?.toLocaleString()}원</td>
                      <td className="border border-gray-300 px-4 py-4 text-right font-bold text-yellow-600">{tx.unpaid_amount?.toLocaleString()}원</td>
                      <td className="border border-gray-300 px-4 py-4 text-center font-bold">{tx.paid_ratio}%</td>
                      <td className="border border-gray-300 px-4 py-4 text-center">{tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</td>
                      <td className="border border-gray-300 px-4 py-4 text-center font-semibold text-blue-600">{typeof tx.days_left === 'number' ? `${tx.days_left}일 전` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dueTotalPages > 1 && (
              <div className="flex justify-center mt-8">
                <Pagination
                  currentPage={duePage}
                  totalPages={dueTotalPages}
                  totalItems={dueTxs.length}
                  itemsPerPage={duePageSize}
                  onPageChange={setDuePage}
                  showPageSize={false}
                  showInfo={false}
                  scrollToTopOnPageChange={false}
                />
              </div>
            )}
            </>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dueTxsPage.map((tx: any) => (
                <div key={tx.id} className="bg-white border-2 border-blue-200 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <div className="font-bold text-blue-800 mb-3 text-xl flex items-center gap-2">
                    👤 {tx.customer_name}
                  </div>
                  <div className="text-lg text-gray-600 mb-3">
                    🚜 기종: <span className="font-semibold">{tx.model}</span> / 📱 모델: <span className="font-semibold">{tx.model_type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-base mb-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-600 text-sm">💰 전체금액</div>
                      <div className="font-bold text-lg">{tx.amount?.toLocaleString()}원</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-blue-600 text-sm">💳 입금액</div>
                      <div className="font-bold text-lg text-blue-700">{tx.paid_amount?.toLocaleString()}원</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <div className="text-yellow-600 text-sm">💸 미수금</div>
                      <div className="font-bold text-lg text-yellow-700">{tx.unpaid_amount?.toLocaleString()}원</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-green-600 text-sm">📊 입금율</div>
                      <div className="font-bold text-lg text-green-700">{tx.paid_ratio}%</div>
                    </div>
                  </div>
                  <div className="text-base text-gray-600 mb-2">📅 지급예정일: <span className="font-semibold">{tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</span></div>
                  <div className="text-base">⏰ 남은일수: <span className="font-bold text-blue-600">{typeof tx.days_left === 'number' ? `${tx.days_left}일 전` : '-'}</span></div>
                </div>
              ))}
            </div>
            {/* 카드형 페이지네이션 */}
            {dueTotalPages > 1 && (
              <div className="flex justify-center mt-8">
                <Pagination
                  currentPage={duePage}
                  totalPages={dueTotalPages}
                  totalItems={dueTxs.length}
                  itemsPerPage={duePageSize}
                  onPageChange={setDuePage}
                  showPageSize={false}
                  showInfo={false}
                  scrollToTopOnPageChange={false}
                />
              </div>
            )}
            </>
          )}
        </div>

        {/* 지급예정일이 지난 거래건 */}
        {Array.isArray((data as any).overdueTxs) && (data as any).overdueTxs.length > 0 && (
          <div className="bg-red-50 p-8 rounded-lg shadow-lg border-2 border-red-200 mb-8">
            <h3 className="text-2xl font-bold mb-6 text-red-800 flex items-center gap-2">
              ⚠️ 지급예정일이 지난 거래건
            </h3>
            {viewMode === 'table' ? (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-lg border-collapse bg-white rounded-lg">
                  <thead>
                    <tr className="bg-red-100 border-b-2 border-red-200">
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">👤 고객명</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">🚜 기종</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">📱 모델</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">💰 전체금액</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">💳 입금액</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">💸 미수금</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">📊 입금율</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">📅 지급예정일</th>
                      <th className="border border-gray-300 px-4 py-4 font-bold text-gray-800">🚨 경과일수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueTxsPage.map((tx: any) => (
                      <tr key={tx.id} className="border-b hover:bg-red-50">
                        <td className="border border-gray-300 px-4 py-4 font-semibold">{tx.customer_name}</td>
                        <td className="border border-gray-300 px-4 py-4">{tx.model}</td>
                        <td className="border border-gray-300 px-4 py-4">{tx.model_type}</td>
                        <td className="border border-gray-300 px-4 py-4 text-right font-bold">{tx.amount?.toLocaleString()}원</td>
                        <td className="border border-gray-300 px-4 py-4 text-right font-bold text-blue-600">{tx.paid_amount?.toLocaleString()}원</td>
                        <td className="border border-gray-300 px-4 py-4 text-right font-bold text-red-600">{tx.unpaid_amount?.toLocaleString()}원</td>
                        <td className="border border-gray-300 px-4 py-4 text-center font-bold">{tx.paid_ratio}%</td>
                        <td className="border border-gray-300 px-4 py-4 text-center">{tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</td>
                        <td className="border border-gray-300 px-4 py-4 text-center text-red-700 font-bold text-xl">{typeof tx.overdue_days === 'number' ? `${tx.overdue_days}일` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {overdueTotalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <Pagination
                    currentPage={overduePage}
                    totalPages={overdueTotalPages}
                    totalItems={overdueTxs.length}
                    itemsPerPage={overduePageSize}
                    onPageChange={setOverduePage}
                    showPageSize={false}
                    showInfo={false}
                    scrollToTopOnPageChange={false}
                  />
                </div>
              )}
              </>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overdueTxsPage.map((tx: any) => (
                  <div key={tx.id} className="bg-white border-2 border-red-200 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                    <div className="font-bold text-red-800 mb-3 text-xl flex items-center gap-2">
                      👤 {tx.customer_name}
                    </div>
                    <div className="text-lg text-gray-600 mb-3">
                      🚜 기종: <span className="font-semibold">{tx.model}</span> / 📱 모델: <span className="font-semibold">{tx.model_type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-base mb-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-600 text-sm">💰 전체금액</div>
                        <div className="font-bold text-lg">{tx.amount?.toLocaleString()}원</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-blue-600 text-sm">💳 입금액</div>
                        <div className="font-bold text-lg text-blue-700">{tx.paid_amount?.toLocaleString()}원</div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="text-red-600 text-sm">💸 미수금</div>
                        <div className="font-bold text-lg text-red-700">{tx.unpaid_amount?.toLocaleString()}원</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-green-600 text-sm">📊 입금율</div>
                        <div className="font-bold text-lg text-green-700">{tx.paid_ratio}%</div>
                      </div>
                    </div>
                    <div className="text-base text-gray-600 mb-3">📅 지급예정일: <span className="font-semibold">{tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</span></div>
                    <div className="bg-red-100 p-3 rounded-lg border-2 border-red-300">
                      <div className="text-red-700 font-bold text-lg flex items-center gap-2">
                        🚨 경과일수: <span className="text-xl">{typeof tx.overdue_days === 'number' ? `${tx.overdue_days}일` : '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 카드형 페이지네이션 */}
              {overdueTotalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <Pagination
                    currentPage={overduePage}
                    totalPages={overdueTotalPages}
                    totalItems={overdueTxs.length}
                    itemsPerPage={overduePageSize}
                    onPageChange={setOverduePage}
                    showPageSize={false}
                    showInfo={false}
                    scrollToTopOnPageChange={false}
                  />
                </div>
              )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
