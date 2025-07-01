"use client";
import { useEffect, useState } from 'react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PointElement
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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  useEffect(() => {
    async function fetchDashboard() {
      const response = await fetch('/api/dashboard');
      const dashboardData = await response.json();
      setData(dashboardData);
    }
    fetchDashboard();
  }, []);

  if (!data) return <div>로딩 중...</div>;

  // 미수금 연령 분석 차트 데이터
  const agingLabels = data.agingAnalysis.map(item => 
    new Date(item.created_at).toLocaleDateString('ko-KR')
  );
  const agingData = data.agingAnalysis.map(item => item.amount);

  // 상위 고객 차트 데이터
  const customerLabels = data.topCustomers.map(customer => customer.name);
  const customerData = data.topCustomers.map(customer => 
    customer.transactions.reduce((sum, tx) => 
      tx.status === 'unpaid' ? sum + tx.amount : sum, 0
    )
  );

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

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-2">대시보드</h1>
      <div className="mb-4 text-gray-500 font-medium">오늘: {data.today}</div>
      <div className="flex gap-2 mb-4">
        <button onClick={handlePdfDownload} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800">PDF 리포트</button>
        <button onClick={handleExcelDownload} className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800">엑셀 리포트</button>
      </div>
      
      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">총 미수금</h3>
          <p className="text-3xl font-bold text-blue-600">
            {new Intl.NumberFormat('ko-KR', { 
              style: 'currency', 
              currency: 'KRW'
            }).format(data.totalUnpaid)}
          </p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 미수금 연령 분석 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">미수금 연령 분석</h3>
          <Line
            data={{
              labels: agingLabels,
              datasets: [{
                label: '미수금 추이',
                data: agingData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'top' as const,
                }
              }
            }}
          />
        </div>

        {/* 상위 미수금 고객 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">상위 미수금 고객</h3>
          <Bar
            data={{
              labels: customerLabels,
              datasets: [{
                label: '미수금액',
                data: customerData,
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
              }]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'top' as const,
                }
              }
            }}
          />
        </div>
      </div>

      {/* 상위 고객 상세 테이블 */}
      <div className="bg-white p-4 rounded-lg shadow mt-8">
        <h3 className="text-lg font-semibold mb-4">상위 고객 상세</h3>
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">고객유형</th>
              <th className="px-4 py-2">주소</th>
              <th className="px-4 py-2">사진</th>
              <th className="px-4 py-2">미수금액</th>
            </tr>
          </thead>
          <tbody>
            {data.topCustomers.map((customer: any) => (
              <tr key={customer.id} className="border-b">
                <td className="px-4 py-2">{customer.name}</td>
                <td className="px-4 py-2">{Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}</td>
                <td className="px-4 py-2">{[customer.address_road, customer.address_jibun, customer.zipcode].filter(Boolean).join(' / ')}</td>
                <td className="px-4 py-2">
                  {customer.photos && customer.photos.length > 0 ? (
                    <div className="flex space-x-1">
                      {customer.photos.slice(0, 3).map((photo: any, idx: number) => (
                        <img key={idx} src={photo.url} alt="고객사진" className="w-8 h-8 rounded object-cover" />
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td className="px-4 py-2 text-right">{customer.unpaidAmount.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 월별 미수금 차트 */}
      {data.monthlyStats && data.monthlyStats.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-8">
          <h3 className="text-lg font-semibold mb-4">월별 미수금 통계</h3>
          <Line data={{
            labels: data.monthlyStats.map((m: any) => m.month),
            datasets: [{
              label: '미수금 합계',
              data: data.monthlyStats.map((m: any) => m.total),
              borderColor: 'rgb(255, 99, 132)',
              tension: 0.1
            }]
          }} />
        </div>
      )}

      {/* 고객유형별 미수금 차트 */}
      {data.typeStats && data.typeStats.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-8">
          <h3 className="text-lg font-semibold mb-4">고객유형별 미수금</h3>
          <Bar data={{
            labels: data.typeStats.map((t: any) => t.type),
            datasets: [{
              label: '미수금 합계',
              data: data.typeStats.map((t: any) => t.total),
              backgroundColor: 'rgba(255, 206, 86, 0.5)'
            }]
          }} />
        </div>
      )}

      {/* 거래 상태별 합계 차트 */}
      {data.statusStats && data.statusStats.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-8">
          <h3 className="text-lg font-semibold mb-4">거래 상태별 합계</h3>
          <Bar data={{
            labels: data.statusStats.map((s: any) => s.status),
            datasets: [{
              label: '합계',
              data: data.statusStats.map((s: any) => s.total),
              backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
          }} />
        </div>
      )}

      {/* 이번달 지급예정 거래건/지급지연 거래건 뷰 토글 */}
      <div className="flex gap-2 mt-8 mb-2">
        <button
          className={`px-3 py-1 rounded ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setViewMode('table')}
        >그리드(표) 보기</button>
        <button
          className={`px-3 py-1 rounded ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setViewMode('card')}
        >카드형 보기</button>
      </div>
      {/* 이번달 지급예정 거래건 */}
      {Array.isArray((data as any).dueThisMonth) && (data as any).dueThisMonth.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-4">
          <h3 className="text-lg font-semibold mb-4 text-blue-700">이번달 지급예정 거래건</h3>
          {viewMode === 'table' ? (
            <table className="min-w-full">
              <thead>
                <tr className="bg-blue-50">
                  <th className="px-2 py-2 text-center">고객명</th>
                  <th className="px-2 py-2 text-center">기종</th>
                  <th className="px-2 py-2 text-center">모델</th>
                  <th className="px-2 py-2 text-center">전체금액</th>
                  <th className="px-2 py-2 text-center">입금액</th>
                  <th className="px-2 py-2 text-center">미수금</th>
                  <th className="px-2 py-2 text-center">입금율</th>
                  <th className="px-2 py-2 text-center">지급예정일</th>
                  <th className="px-2 py-2 text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {(data as any).dueThisMonth.map((tx: any) => (
                  <tr key={tx.id} className="border-b">
                    <td className="px-2 py-2 text-center">{tx.customer_name}</td>
                    <td className="px-2 py-2 text-center">{tx.model}</td>
                    <td className="px-2 py-2 text-center">{tx.model_type}</td>
                    <td className="px-2 py-2 text-center">{tx.amount?.toLocaleString()}원</td>
                    <td className="px-2 py-2 text-center">{tx.paid_amount?.toLocaleString()}원</td>
                    <td className="px-2 py-2 text-center">{tx.unpaid_amount?.toLocaleString()}원</td>
                    <td className="px-2 py-2 text-center">{tx.paid_ratio}%</td>
                    <td className="px-2 py-2 text-center">{tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-2 text-center">{typeof tx.days_left === 'number' ? `${tx.days_left}일 전` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data as any).dueThisMonth.map((tx: any) => (
                <div key={tx.id} className="border rounded-lg p-4 shadow bg-blue-50">
                  <div className="font-bold text-blue-800 mb-1">{tx.customer_name}</div>
                  <div className="text-sm text-gray-600 mb-1">기종: {tx.model} / 모델: {tx.model_type}</div>
                  <div className="flex flex-wrap gap-2 text-sm mb-1">
                    <span>전체금액: <b>{tx.amount?.toLocaleString()}원</b></span>
                    <span>입금액: <b className="text-green-700">{tx.paid_amount?.toLocaleString()}원</b></span>
                    <span>미수금: <b className="text-red-700">{tx.unpaid_amount?.toLocaleString()}원</b></span>
                    <span>입금율: <b>{tx.paid_ratio}%</b></span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">지급예정일: {tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</div>
                  <div className="text-xs">상태: <b>{typeof tx.days_left === 'number' ? `${tx.days_left}일 전` : '-'}</b></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 지급예정일이 지난 거래건 */}
      {Array.isArray((data as any).overdueTxs) && (data as any).overdueTxs.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-8">
          <h3 className="text-lg font-semibold mb-4 text-red-700">지급예정일이 지난 거래건</h3>
          {viewMode === 'table' ? (
            <table className="min-w-full">
              <thead>
                <tr className="bg-red-50">
                  <th className="px-2 py-2 text-center">고객명</th>
                  <th className="px-2 py-2 text-center">기종</th>
                  <th className="px-2 py-2 text-center">모델</th>
                  <th className="px-2 py-2 text-center">전체금액</th>
                  <th className="px-2 py-2 text-center">입금액</th>
                  <th className="px-2 py-2 text-center">미수금</th>
                  <th className="px-2 py-2 text-center">입금율</th>
                  <th className="px-2 py-2 text-center">지급예정일</th>
                  <th className="px-2 py-2 text-center">상태</th>
                  <th className="px-2 py-2 text-center">경과일수</th>
                </tr>
              </thead>
              <tbody>
                {(data as any).overdueTxs.map((tx: any) => (
                  <tr key={tx.id} className="border-b">
                    <td className="px-2 py-2 text-center">{tx.customer_name}</td>
                    <td className="px-2 py-2 text-center">{tx.model}</td>
                    <td className="px-2 py-2 text-center">{tx.model_type}</td>
                    <td className="px-2 py-2 text-center">{tx.amount?.toLocaleString()}원</td>
                    <td className="px-2 py-2 text-center">{tx.paid_amount?.toLocaleString()}원</td>
                    <td className="px-2 py-2 text-center">{tx.unpaid_amount?.toLocaleString()}원</td>
                    <td className="px-2 py-2 text-center">{tx.paid_ratio}%</td>
                    <td className="px-2 py-2 text-center">{tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-2 text-center">{typeof tx.overdue_days === 'number' ? `${tx.overdue_days}일` : '-'}</td>
                    <td className="px-2 py-2 text-center text-red-600 font-bold">{typeof tx.overdue_days === 'number' ? `${tx.overdue_days}일` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data as any).overdueTxs.map((tx: any) => (
                <div key={tx.id} className="border rounded-lg p-4 shadow bg-red-50">
                  <div className="font-bold text-red-800 mb-1">{tx.customer_name}</div>
                  <div className="text-sm text-gray-600 mb-1">기종: {tx.model} / 모델: {tx.model_type}</div>
                  <div className="flex flex-wrap gap-2 text-sm mb-1">
                    <span>전체금액: <b>{tx.amount?.toLocaleString()}원</b></span>
                    <span>입금액: <b className="text-green-700">{tx.paid_amount?.toLocaleString()}원</b></span>
                    <span>미수금: <b className="text-red-700">{tx.unpaid_amount?.toLocaleString()}원</b></span>
                    <span>입금율: <b>{tx.paid_ratio}%</b></span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">지급예정일: {tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '-'}</div>
                  <div className="text-xs">상태: <b>{typeof tx.overdue_days === 'number' ? `${tx.overdue_days}일` : '-'}</b></div>
                  <div className="text-xs text-red-700 font-bold">경과일수: {typeof tx.overdue_days === 'number' ? `${tx.overdue_days}일` : '-'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
