"use client";
import { useEffect, useState } from 'react';
import { CustomerList } from '@/components/customer-list';
import { CustomerForm } from '@/components/customer-form';
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
      <h1 className="text-2xl font-bold mb-8">채무자 관리</h1>
      <div className="grid grid-cols-1 gap-8">
        <CustomerForm onSuccess={fetchCustomers} />
        <CustomerList customers={customers} />
        <SmsSender customers={customers} onSuccess={fetchCustomers} />
      </div>
    </div>
  );
} 