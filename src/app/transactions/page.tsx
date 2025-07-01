"use client";
import { useEffect, useState } from 'react';
import { TransactionList } from '@/components/transaction-list';
import type { Customer } from '@/types/database';

export default function TransactionsPage() {
  // const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function fetchCustomers() {
      const response = await fetch('/api/customers');
      const data = await response.json();
              // setCustomers(data);
    }
    fetchCustomers();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-5 py-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">거래 관리</h1>
        <TransactionList />
      </div>
    </div>
  );
} 