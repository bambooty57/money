"use client";
import { useEffect, useState } from 'react';
import { PaginatedCustomerList } from '@/components/paginated-customer-list';
import { CustomerForm } from '@/components/customer-form';
import SmsSender from '@/components/sms-sender';
import type { Customer } from '@/types/database';
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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
      <div className="max-w-screen-2xl mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
            👥 고객 관리
          </h1>
          <div className="flex space-x-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="text-xl px-8 py-4 bg-gray-900 hover:bg-gray-800 rounded-lg shadow-lg flex items-center gap-2">
                  <Upload className="mr-2 h-6 w-6" /> 엑셀로 일괄 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl">엑셀로 고객 및 거래내역 등록</DialogTitle>
                </DialogHeader>
                <ExcelUploadForm />
              </DialogContent>
            </Dialog>
            <Button
              onClick={async () => {
                const res = await fetch('/api/customers/export');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '고객목록.xlsx';
                a.click();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
              }}
              size="lg"
              className="text-xl px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg shadow-lg flex items-center gap-2"
              title="엑셀 다운로드"
            >
              <Upload className="mr-2 h-6 w-6" /> 엑셀 다운로드
            </Button>
            <Button onClick={handleNew} size="lg" className="text-xl px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg flex items-center gap-2">
              <PlusCircle className="mr-2 h-6 w-6" /> 신규 고객 추가
            </Button>
          </div>
        </div>
        <CustomerForm
          open={formOpen}
          setOpen={setFormOpen}
          onSuccess={() => {
            setFormOpen(false);
            fetchCustomers();
          }}
          customer={editCustomer}
        />
        <PaginatedCustomerList enableActions={true} onEdit={handleEdit} onSelectCustomer={handleSelectCustomer} />

        <div className="mt-8" />

        <SmsSender selectedCustomer={selectedCustomer} onSuccess={fetchCustomers} />
      </div>
    </div>
  );
} 