"use client";
import { useEffect, useState } from 'react';
import { PaginatedCustomerList } from '@/components/paginated-customer-list';
import { CustomerForm } from '@/components/customer-form';
import SmsSender from '@/components/sms-sender';
import type { Database } from '@/types/database';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExcelUploadForm } from '@/components/excel-upload-form';
import { usePaymentsRealtime } from '@/lib/usePaymentsRealtime';
import { useCustomersRealtime } from '@/lib/useCustomersRealtime';
import ScrollToTop from '@/components/ui/scroll-to-top';

type Customer = Database['public']['Tables']['customers']['Row'];

export default function CustomersPage() {
  usePaymentsRealtime();
  useCustomersRealtime();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const response = await fetch('/api/customers');
    const data = await response.json();
    setCustomers(data.data || []);
  }

  // 신규 등록 버튼 클릭
  function handleNew() {
    setEditCustomer(null);
    setFormOpen(true);
  }

  // 수정 버튼 클릭
  function handleEdit(customer: Customer) {
    setEditCustomer(customer);
    setFormOpen(true);
  }

  // 고객 체크박스 선택 핸들러
  function handleSelectCustomer(customer: Customer | null) {
    setSelectedCustomer(customer);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-4 md:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 flex items-center gap-3">
            👥 고객 관리
          </h1>
          <div className="flex space-x-2 md:space-x-4 w-full sm:w-auto">
            <Button onClick={handleNew} size="lg" className="text-base md:text-xl px-4 md:px-8 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg flex items-center gap-2 flex-1 sm:flex-none">
              <PlusCircle className="mr-1 md:mr-2 h-5 md:h-6 w-5 md:w-6" />
              <span className="hidden sm:inline">신규 고객 추가</span>
              <span className="sm:hidden">추가</span>
            </Button>
          </div>
        </div>
        <CustomerForm
          open={formOpen}
          setOpen={setFormOpen}
          onSuccess={() => {
            // 즉시 refresh key 업데이트하여 데이터 새로고침
            setRefreshKey(k => k + 1);
            // 모달은 CustomerForm 내부에서 타이머로 닫힘
          }}
          customer={editCustomer}
        />
        <PaginatedCustomerList enableActions={true} onEdit={handleEdit} onSelectCustomer={handleSelectCustomer} refreshKey={refreshKey} />

        <div className="mt-8" />

        <SmsSender selectedCustomer={selectedCustomer} onSuccess={fetchCustomers} />
      </div>
    </div>
  );
} 