import { Suspense } from 'react';
import { TransactionList } from '@/components/transaction-list';
import ScrollToTop from '@/components/ui/scroll-to-top';

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-4">로딩 중...</div>}>
      <div className="min-h-screen bg-gray-50">
        <ScrollToTop />
        <div className="max-w-screen-2xl mx-auto px-5 py-6">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">거래 관리</h1>
          <TransactionList />
        </div>
      </div>
    </Suspense>
  );
} 