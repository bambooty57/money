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
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">고객 관리</h1>
        <div className="flex space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" /> 엑셀로 일괄 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>엑셀로 고객 및 거래내역 등록</DialogTitle>
              </DialogHeader>
              <ExcelUploadForm />
            </DialogContent>
          </Dialog>
          <Button onClick={handleNew}>
            <PlusCircle className="mr-2 h-4 w-4" /> 신규 고객 추가
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
      <SmsSender selectedCustomer={selectedCustomer} onSuccess={fetchCustomers} />
    </div>
  );
} 