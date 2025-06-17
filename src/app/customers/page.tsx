"use client";
import { useEffect, useState } from 'react';
import { CustomerList } from '@/components/customer-list';
import SmsSender from '@/components/sms-sender';
import type { Customer } from '@/types/database';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const response = await fetch('/api/customers');
    const data = await response.json();
    setCustomers(data);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">고객 관리</h1>
      <div className="grid grid-cols-1 gap-8">
        <CustomerList customers={customers} />
        <SmsSender customers={customers} onSuccess={fetchCustomers} />
      </div>
    </div>
  );
} 