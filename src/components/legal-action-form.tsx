"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/types/database';

interface LegalActionFormProps {
  customers: Customer[];
  onSuccess?: () => void;
}

export default function LegalActionForm({ customers, onSuccess }: LegalActionFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    type: '',
    description: '',
    status: 'in_progress'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('legal_actions')
        .insert(formData);

      if (error) throw error;
      
      setFormData({
        customer_id: '',
        type: '',
        description: '',
        status: 'in_progress'
      });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('법적 조치 등록 실패:', error);
      alert('법적 조치를 등록하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          대상 거래처
        </label>
        <select
          value={formData.customer_id}
          onChange={e => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
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
          조치 유형
        </label>
        <select
          value={formData.type}
          onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        >
          <option value="">선택하세요</option>
          <option value="내용증명">내용증명</option>
          <option value="지급명령">지급명령</option>
          <option value="가압류">가압류</option>
          <option value="소송">소송</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          상세 내용
        </label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="법적 조치의 상세 내용을 입력하세요"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          상태
        </label>
        <select
          value={formData.status}
          onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'completed' | 'in_progress' }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        >
          <option value="in_progress">진행중</option>
          <option value="completed">완료</option>
        </select>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white rounded-md ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? '처리중...' : '법적 조치 등록'}
        </button>
      </div>
    </form>
  );
} 