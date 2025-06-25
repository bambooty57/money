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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

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
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>
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
    </main>
  );
}
