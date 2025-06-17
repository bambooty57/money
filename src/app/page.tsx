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

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>
      
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
    </main>
  );
}
