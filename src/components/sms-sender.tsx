"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/types/database';

interface SmsSenderProps {
  customers: Customer[];
  onSuccess?: () => void;
}

export default function SmsSender({ customers, onSuccess }: SmsSenderProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_ids: [] as string[],
    message: '',
    template: ''
  });

  const templates = {
    payment_reminder: '안녕하세요, {고객명}님. 구보다농기계 영암대리점입니다.\n미납금 {금액}원의 납부기한이 {기한}일 남았습니다.\n빠른 납부 부탁드립니다.',
    overdue_notice: '안녕하세요, {고객명}님. 구보다농기계 영암대리점입니다.\n{금액}원의 미납금이 {일수}일 연체되었습니다.\n오늘 중 납부를 부탁드립니다.',
    legal_notice: '안녕하세요, {고객명}님. 구보다농기계 영암대리점입니다.\n{금액}원의 미납금이 장기 연체되어 법적 조치를 준비 중입니다.\n빠른 연락 부탁드립니다.'
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const template = e.target.value;
    setFormData(prev => ({
      ...prev,
      template,
      message: template ? templates[template as keyof typeof templates] : ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.customer_ids.length === 0) {
      alert('수신자를 선택해주세요.');
      return;
    }
    if (!formData.message.trim()) {
      alert('메시지 내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      // SMS 발송 요청
      const { error } = await supabase
        .from('sms_messages')
        .insert(
          formData.customer_ids.map(customer_id => ({
            customer_id,
            content: formData.message,
            status: 'pending'
          }))
        );

      if (error) throw error;

      setFormData({
        customer_ids: [],
        message: '',
        template: ''
      });
      
      if (onSuccess) onSuccess();
      alert('SMS 발송이 요청되었습니다.');
    } catch (error) {
      console.error('SMS 발송 실패:', error);
      alert('SMS 발송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          수신자 선택
        </label>
        <select
          multiple
          value={formData.customer_ids}
          onChange={e => setFormData(prev => ({
            ...prev,
            customer_ids: Array.from(e.target.selectedOptions, option => option.value)
          }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          size={5}
          required
        >
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name} ({customer.phone})
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          Ctrl 또는 Shift 키를 누른 상태로 여러 명을 선택할 수 있습니다.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          메시지 템플릿
        </label>
        <select
          value={formData.template}
          onChange={handleTemplateChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">직접 입력</option>
          <option value="payment_reminder">납부 안내</option>
          <option value="overdue_notice">연체 안내</option>
          <option value="legal_notice">법적 조치 안내</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          메시지 내용
        </label>
        <textarea
          value={formData.message}
          onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
          rows={6}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="메시지 내용을 입력하세요"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          {formData.message.length}/2000자
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white rounded-md ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? '처리중...' : 'SMS 발송'}
        </button>
      </div>
    </form>
  );
} 