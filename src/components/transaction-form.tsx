"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/types/database';

interface TransactionFormProps {
  customers: Customer[];
  onSuccess?: () => void;
}

export default function TransactionForm({ customers, onSuccess }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    type: '',
    amount: '',
    status: 'unpaid' as 'paid' | 'unpaid',
    description: '',
    date: '',
    proof: null as File | null,
    auto_calculate: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('transactions')
        .insert({
          ...formData,
          amount: parseFloat(formData.amount),
          date: formData.date
        });

      if (error) throw error;
      
      setFormData({
        customer_id: '',
        type: '',
        amount: '',
        status: 'unpaid' as 'paid' | 'unpaid',
        description: '',
        date: '',
        proof: null,
        auto_calculate: true
      });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('거래 등록 실패:', error);
      alert('거래를 등록하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          거래처
        </label>
        <select
          value={formData.customer_id}
          onChange={e => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
          title="거래처를 선택하세요"
        >
          <option value="">선택하세요</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name} ({customer.business_number})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          거래 유형
        </label>
        <select
          value={formData.type}
          onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
          title="거래 유형을 선택하세요"
        >
          <option value="">선택하세요</option>
          <option value="판매">판매</option>
          <option value="입금">입금</option>
          <option value="할인">할인</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          금액
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="number"
            value={formData.amount}
            onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-blue-500 focus:ring-blue-500"
            placeholder="0"
            required
            title="거래 금액을 입력하세요"
            aria-label="거래 금액"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-gray-500 sm:text-sm">원</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          일자
        </label>
        <input
          type="date"
          value={formData.date}
          onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
          title="거래 일자를 입력하세요"
          aria-label="거래 일자"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          상세
        </label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="추가 설명을 입력하세요"
          title="거래 상세를 입력하세요"
          aria-label="거래 상세"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          증빙 업로드
        </label>
        <input
          type="file"
          onChange={e => {
            if (e.target.files) {
              const file = e.target.files[0];
              setFormData(prev => ({ ...prev, proof: file }));
            }
          }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          accept="image/*"
          title="거래 증빙을 업로드하세요"
          aria-label="거래 증빙 업로드"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          상태
        </label>
        <select
          value={formData.status}
          onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'paid' | 'unpaid' }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
          title="거래 상태를 선택하세요"
          aria-label="거래 상태"
        >
          <option value="unpaid">미수</option>
          <option value="paid">완료</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          미수금 자동 계산
        </label>
        <input
          type="checkbox"
          checked={formData.auto_calculate}
          onChange={e => setFormData(prev => ({ ...prev, auto_calculate: e.target.checked }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          title="미수금을 자동으로 계산하세요"
          aria-label="미수금 자동 계산"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white rounded-md ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title={loading ? '거래 등록 중...' : '거래 등록'}
        >
          {loading ? '처리중...' : '거래 등록'}
        </button>
      </div>
    </form>
  );
} 