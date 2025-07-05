"use client";
import { useEffect, useState } from 'react';
import { LegalActionList } from '@/components/legal-action-list';
import LegalActionForm from '@/components/legal-action-form';
import type { Customer } from '@/types/database';

export default function LegalActionsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const response = await fetch('/api/customers');
    const data = await response.json();
    setCustomers(data.data as Customer[]);
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-5 py-8">
      <h1 className="text-2xl font-bold mb-8">법적 조치 관리</h1>
      <div className="grid grid-cols-1 gap-8">
        <LegalActionList />
        <LegalActionForm customers={customers} onSuccess={fetchCustomers} />
      </div>
    </div>
  );
} 