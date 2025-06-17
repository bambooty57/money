"use client";
import { useEffect, useState } from 'react';
import { TransactionList } from '@/components/transaction-list';
import type { Customer } from '@/types/database';

export default function TransactionsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function fetchCustomers() {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    }
    fetchCustomers();
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">거래 관리</h1>
      <TransactionList />
    </main>
  );
} 