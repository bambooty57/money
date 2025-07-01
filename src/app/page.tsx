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
  typeStats: Array<{
    type: string;
    total: number;
  }>;
  statusStats: Array<{
    status: string;
    total: number;
  }>;
  dueThisMonth: Array<{
    id: string;
    customer_id: string;
    due_date?: string;
    amount?: number;
    status: string;
  }>;
  overdueTxs: Array<{
    id: string;
    customer_id: string;
    due_date?: string;
    amount?: number;
    status: string;
    overdue_days?: number;
  }>;
  today: string;
  monthlySalesStats: Array<{
    month: string;
    total: number;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  // 갤러리 모달 상태
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryBackdropRef = useRef<HTMLDivElement>(null);
  // 연도 선택 상태 추가
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    async function fetchDashboard() {
      const response = await fetch('/api/dashboard');
      const dashboardData = await response.json();
      setData(dashboardData);
    }
    fetchDashboard();
  }, []);

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

  if (!data) return <div>로딩 중...</div>;

  // 미수금 연령 분석 차트 데이터
  const agingLabels = data.agingAnalysis.map(item => 
    new Date(item.created_at).toLocaleDateString('ko-KR')
  );
  const agingData = data.agingAnalysis.map(item => item.amount);

  // 상위 고객 차트 데이터
  const customerLabels = data.topCustomers.map(customer => [
    customer.name,
    `₩${(customer.unpaidAmount || 0).toLocaleString('ko-KR')}`
  ]);
  const customerData = data.topCustomers.map(customer => 
    customer.transactions.reduce((sum, tx) => 
      tx.status === 'unpaid' ? sum + tx.amount : sum, 0
    )
  );
  // 각 고객별 미수 거래 건수
  const customerCounts = data.topCustomers.map(c => c.transactions.filter(tx => tx.status === 'unpaid').length);

  const handlePdfDownload = () => {
    const doc = new jsPDF();
    doc.text('대시보드 리포트', 10, 10);
    doc.save('dashboard-report.pdf');
  };
  const handleExcelDownload = async () => {
    // 예시: /api/customers/export 재활용
    const res = await fetch('/api/customers/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-report.xlsx';
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  // 스택형 Bar 차트용 색상 배열
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
  // 고객별 거래 건수 중 최대값
  const maxTxCount = Math.max(...data.topCustomers.map(c => c.transactions.filter(tx => tx.status === 'unpaid').length));
  // Bar 차트 y축 최대값 계산
  const maxUnpaid = Math.max(...data.topCustomers.map(c => c.unpaidAmount || 0));
  const yAxisMax = Math.ceil(maxUnpaid / 10000000) * 10000000 + 10000000; // 1천만 단위 올림
  // 각 dataset(스택)은 거래 n번째 건의 금액 배열
  const stackDatasets = Array.from({ length: maxTxCount }).map((_, stackIdx) => ({
    label: `${stackIdx + 1}번째 건`,
    data: data.topCustomers.map(c => {
      const unpaidTxs = (c.transactions as any[]).filter((tx: any) => tx.status === 'unpaid');
      return unpaidTxs[stackIdx]?.amount || 0;
    }),
    backgroundColor: stackColors[stackIdx % stackColors.length],
    borderColor: stackBorderColors[stackIdx % stackBorderColors.length],
    borderWidth: 2,
    datalabels: {
      formatter: (value: any, context: any) => {
        if (!value || value === 0) return '';
        const customerIdx = context.dataIndex;
        const customer = data.topCustomers[customerIdx];
        const unpaidTxs = (customer.transactions as any[]).filter((tx: any) => tx.status === 'unpaid');
        const tx = unpaidTxs[stackIdx];
        if (!tx) return `₩${Number(value).toLocaleString('ko-KR')}`;
        const txInfo = [tx.type, tx.model, tx.model_type].filter(Boolean).join('/');
        return `₩${Number(value).toLocaleString('ko-KR')}` + (txInfo ? `\n${txInfo}` : '');
      },
      anchor: (ctx: any) => ctx.dataset.data[ctx.dataIndex] < maxUnpaid * 0.1 ? 'end' : 'center',
      align: (ctx: any) => ctx.dataset.data[ctx.dataIndex] < maxUnpaid * 0.1 ? 'end' : 'center',
      clip: false,
      color: '#fff',
      font: { weight: 700, size: 14 },
      display: true,
    }
  }));

  // 연도 선택 드롭다운용 연도 배열 (2022~현재)
  const yearOptions = [];
  for (let y = 2022; y <= currentYear; y++) yearOptions.push(y);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 갤러리 모달 */}
      {galleryOpen && (
        <div ref={galleryBackdropRef} onClick={handleBackdropClick} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" style={{backdropFilter:'blur(2px)'}}>
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
                className="max-w-[80vw] max-h-[70vh] rounded-lg border-4 border-blue-200 shadow-lg bg-white"
                style={{objectFit:'contain'}}
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
      {/* 시니어 친화적 대시보드 전체 래퍼 */}
      <div className="max-w-screen-2xl mx-auto px-8 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-gray-200">
          <h1 className="text-4xl font-bold mb-6 text-gray-800 flex items-center gap-3">
            📊 관리 대시보드
          </h1>
          <div className="flex items-center justify-between">
            <div className="text-xl text-gray-600 font-semibold flex items-center gap-2">
              📅 오늘: <span className="text-blue-600 font-bold">{data.today}</span>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={handlePdfDownload} 
                className="px-8 py-4 bg-gray-700 text-white text-xl rounded-lg hover:bg-gray-800 font-bold shadow-lg transition-colors duration-200 flex items-center gap-2"
              >
                📄 PDF 리포트
              </button>
              <button 
                onClick={handleExcelDownload} 
                className="px-8 py-4 bg-green-700 text-white text-xl rounded-lg hover:bg-green-800 font-bold shadow-lg transition-colors duration-200 flex items-center gap-2"
              >
                📊 엑셀 리포트
              </button>
            </div>
          </div>
        </div>

        {/* KPI 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 p-8 rounded-lg shadow-lg border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">💰</span>
              <h3 className="text-xl font-bold text-blue-700">총 미수금</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.totalUnpaid)}
            </p>
          </div>
          <div className="bg-green-50 p-8 rounded-lg shadow-lg border-2 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">👥</span>
              <h3 className="text-xl font-bold text-green-700">상위 고객 (10명)</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">₩{data.topCustomers.slice(0, 10).reduce((sum, c) => sum + (c.unpaidAmount || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-yellow-50 p-8 rounded-lg shadow-lg border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">📅</span>
              <h3 className="text-xl font-bold text-yellow-700">이번달 예정</h3>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{(data as any).dueThisMonth?.length || 0}건</p>
            {/* 총 미수금액 표시 */}
            <p className="text-xl font-bold text-yellow-700 mt-2">
              {((data as any).dueThisMonth && (data as any).dueThisMonth.length > 0)
                ? '₩' + (data as any).dueThisMonth.reduce((sum: number, tx: any) => sum + (tx.unpaid_amount || 0), 0).toLocaleString()
                : '₩0'}
            </p>
          </div>
          <div className="bg-red-50 p-8 rounded-lg shadow-lg border-2 border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-xl font-bold text-red-700">연체 거래</h3>
            </div>
            <p className="text-3xl font-bold text-red-600">{(data as any).overdueTxs?.length || 0}건</p>
            {/* 총 미수금액 표시 */}
            <p className="text-xl font-bold text-red-700 mt-2">
              {((data as any).overdueTxs && (data as any).overdueTxs.length > 0)
                ? '₩' + (data as any).overdueTxs.reduce((sum: number, tx: any) => sum + (tx.unpaid_amount || 0), 0).toLocaleString()
                : '₩0'}
            </p>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-1 gap-8 mb-8">
          {/* 채권 연령 분석({selectedYear}) - 미수금/매출 그룹형 Bar 차트 */}
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                📊 채권 연령 분석({selectedYear})
              </h3>
              <select
                className="ml-4 px-4 py-2 border rounded-lg text-lg font-semibold bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                aria-label="연도 선택"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            {/* 월별 YYYY-MM 배열로 매핑 정확히 */}
            {(() => {
              const year = selectedYear;
              const barLabels = Array.from({length: 12}, (_, i) => `${i+1}월`);
              const barMonths = Array.from({length: 12}, (_, i) => `${year}-${String(i+1).padStart(2, '0')}`);
              const salesData = barMonths.map(month => data.monthlySalesStats?.find(m => m.month === month)?.total || 0);
              const unpaidData = barMonths.map(month => data.monthlyStats?.find(m => m.month === month)?.total || 0);
              return (
                <Bar
                  data={{
                    labels: barLabels,
                    datasets: [
                      {
                        label: '매출(신규등록액)',
                        data: salesData,
                        backgroundColor: 'rgba(0, 191, 165, 0.7)', // 청록
                        borderColor: 'rgb(0, 191, 165)',
                        borderWidth: 2,
                        borderRadius: 6,
                      },
                      {
                        label: '미수금(잔액)',
                        data: unpaidData,
                        backgroundColor: 'rgba(255, 99, 132, 0.7)', // 핑크/빨강
                        borderColor: 'rgb(255, 99, 132)',
                        borderWidth: 2,
                        borderRadius: 6,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                        labels: {
                          font: {
                            size: 16,
                            weight: 'bold'
                          }
                        }
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context: any) {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: ₩${value.toLocaleString('ko-KR')}`;
                          }
                        }
                      },
                      datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#222',
                        font: {
                          weight: 700,
                          size: 14
                        },
                        formatter: function(value: any) {
                          return value > 0 ? `₩${Number(value).toLocaleString('ko-KR')}` : '';
                        },
                        display: true,
                      }
                    },
                    scales: {
                      y: {
                        min: 0,
                        ticks: {
                          font: { size: 14 },
                          callback: function(tickValue, _index, _ticks) {
                            if (typeof tickValue === 'string') {
                              return tickValue.includes('\n') ? tickValue.split('\n') : tickValue;
                            }
                            return typeof tickValue === 'number' ? `₩${tickValue.toLocaleString('ko-KR')}` : tickValue;
                          }
                        }
                      },
                      x: {
                        ticks: {
                          font: { size: 14 }
                        }
                      }
                    }
                  }}
                  plugins={[ChartDataLabels]}
                />
              );
            })()}
          </div>
          {/* 상위 미수금 고객 */}
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-200">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              👑 상위 미수금 고객
            </h3>
            {/* 상단 합계액, 범례 모두 삭제 */}
            <Bar
              data={{
                labels: customerLabels,
                datasets: stackDatasets
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  datalabels: {},
                },
                scales: {
                  x: {
                    stacked: true,
                    ticks: { font: { size: 14 } }
                  },
                  y: {
                    stacked: true,
                    max: yAxisMax,
                    ticks: {
                      font: { size: 14 },
                      callback: function(tickValue, _index, _ticks) {
                        return typeof tickValue === 'number' ? `₩${tickValue.toLocaleString('ko-KR')}` : tickValue;
                      }
                    }
                  }
                }
              }}
              plugins={[ChartDataLabels]}
            />
          </div>
        </div>

        {/* 상위 고객 상세 테이블 */}
        <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-gray-200 mb-8">
          <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            📋 상위 고객 상세 정보
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-lg border-collapse">
              <thead>
                <tr className="bg-blue-100 border-b-2 border-blue-200">
                  <th className="border border-gray-300 px-6 py-4 font-bold text-gray-800">👤 이름</th>
                  <th className="border border-gray-300 px-6 py-4 font-bold text-gray-800">🏷️ 고객유형</th>
                  <th className="border border-gray-300 px-6 py-4 font-bold text-gray-800">📍 주소</th>
                  <th className="border border-gray-300 px-6 py-4 font-bold text-gray-800">📷 사진</th>
                  <th className="border border-gray-300 px-6 py-4 font-bold text-gray-800">💰 미수금액</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-blue-50 border-b border-gray-200">
                    <td className="border border-gray-300 px-6 py-4 font-semibold">{customer.name}</td>
                    <td className="border border-gray-300 px-6 py-4">{Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}</td>
                    <td className="border border-gray-300 px-6 py-4">
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
                    <td className="border border-gray-300 px-6 py-4">
                      {customer.photos && customer.photos.length > 0 ? (
                        <div className="flex space-x-2">
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
                                className="w-12 h-12 rounded-lg object-cover border-2 border-gray-300 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                              />
                            </button>
                          ))}
                          {customer.photos.length > 3 && (
                            <div className="w-12 h-12 rounded-lg border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
                              <span className="text-xs text-gray-600 font-bold">+{customer.photos.length - 3}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-lg">-</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-6 py-4 text-right font-bold text-red-600 text-xl">{customer.unpaidAmount.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 거래 상태별 합계 차트 */}
        {data.statusStats && data.statusStats.length > 0 && (
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
        )}

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
        {Array.isArray((data as any).dueThisMonth) && (data as any).dueThisMonth.length > 0 && (
          <div className="bg-blue-50 p-8 rounded-lg shadow-lg border-2 border-blue-200 mb-8">
            <h3 className="text-2xl font-bold mb-6 text-blue-800 flex items-center gap-2">
              📅 이번달 지급예정 거래건
            </h3>
            {viewMode === 'table' ? (
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
                    {(data as any).dueThisMonth.map((tx: any) => (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(data as any).dueThisMonth.map((tx: any) => (
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
            )}
          </div>
        )}

        {/* 지급예정일이 지난 거래건 */}
        {Array.isArray((data as any).overdueTxs) && (data as any).overdueTxs.length > 0 && (
          <div className="bg-red-50 p-8 rounded-lg shadow-lg border-2 border-red-200 mb-8">
            <h3 className="text-2xl font-bold mb-6 text-red-800 flex items-center gap-2">
              ⚠️ 지급예정일이 지난 거래건
            </h3>
            {viewMode === 'table' ? (
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
                    {(data as any).overdueTxs.map((tx: any) => (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(data as any).overdueTxs.map((tx: any) => (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
