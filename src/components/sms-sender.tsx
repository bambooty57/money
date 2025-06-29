"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/types/database';
import { smsTemplates, SmsTemplateCategory, SmsTemplateKey } from '@/types/sms';
import clsx from 'clsx';

interface SmsSenderProps {
  selectedCustomer?: Customer | null;
  onSuccess?: () => void;
}

export default function SmsSender({ selectedCustomer, onSuccess }: SmsSenderProps) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<SmsTemplateCategory | ''>('');
  const [templateKey, setTemplateKey] = useState<SmsTemplateKey | ''>('');
  const [message, setMessage] = useState('');

  // 고객이 바뀌면 모든 선택값 초기화
  useEffect(() => {
    setCategory('');
    setTemplateKey('');
    setMessage('');
  }, [selectedCustomer]);

  // 고객/카테고리/템플릿이 바뀔 때마다 message를 자동 생성
  useEffect(() => {
    if (!selectedCustomer || !category || !templateKey) {
      setMessage('');
      return;
    }
    let template = smsTemplates[category as SmsTemplateCategory][templateKey];
    // 반드시 selectedCustomer.name을 직접 치환
    template = template.replace(/\{고객명\}/g, selectedCustomer.name);
    template = template.replace(/\{미수금\}/g, selectedCustomer.total_unpaid?.toLocaleString() ?? '0');
    template = template.replace(/\{거래건수\}/g, String(selectedCustomer.transaction_count ?? 0));
    // 기타 변수는 빈값
    template = template.replace(/\{납부기한\}/g, '');
    template = template.replace(/\{분할금액\}/g, '');
    setMessage(template);
  }, [selectedCustomer, category, templateKey]);

  // 카테고리 변경 시 템플릿/메시지 초기화
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value as SmsTemplateCategory);
    setTemplateKey('');
    setMessage('');
  };

  // 템플릿 선택 및 자동 치환
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as SmsTemplateKey;
    setTemplateKey(key);
    if (!selectedCustomer || !category || !key) {
      setMessage('');
      return;
    }
    const variables: Record<string, string | number> = {
      '고객명': selectedCustomer.name,
      '미수금': selectedCustomer.total_unpaid?.toLocaleString() ?? '0',
      '거래건수': selectedCustomer.transaction_count ?? 0,
      '납부기한': '',
      '분할금액': ''
    };
    let template = smsTemplates[category as SmsTemplateCategory][key];
    template = template.replace(/\{(.*?)\}/g, (_: string, v: string) => variables[v] !== undefined ? String(variables[v]) : '');
    setMessage(template);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('고객을 1명만 선택해 주세요.');
      return;
    }
    if (!message.trim()) {
      alert('메시지 내용을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('sms_messages')
        .insert([
          {
            customer_id: selectedCustomer.id,
            content: message,
            status: 'pending'
          }
        ]);
      if (error) throw error;
      setCategory('');
      setTemplateKey('');
      setMessage('');
      if (onSuccess) onSuccess();
      alert('SMS 발송이 요청되었습니다.');
    } catch (error) {
      console.error('SMS 발송 실패:', error);
      alert('SMS 발송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카테고리별 템플릿 목록
  const templateOptions = category ? Object.entries(smsTemplates[category as SmsTemplateCategory]) : [];
  // 디버깅용
  // console.log('selectedCustomer:', selectedCustomer);
  // console.log('category:', category);
  // console.log('templateOptions:', templateOptions);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!selectedCustomer && (
        <div className="text-red-500 text-sm">고객을 1명만 체크박스로 선택해 주세요.</div>
      )}
      {/* 카테고리 카드 섹션 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(smsTemplates).map(cat => (
            <button
              type="button"
              key={cat}
              className={clsx(
                'px-4 py-2 rounded border shadow-sm bg-white hover:bg-blue-50 transition',
                category === cat ? 'border-blue-600 ring-2 ring-blue-200 font-bold' : 'border-gray-300'
              )}
              onClick={() => {
                setCategory(cat as SmsTemplateCategory);
                setTemplateKey('');
                setMessage('');
              }}
              disabled={!selectedCustomer}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      {/* 템플릿 카드 섹션 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">메시지 템플릿</label>
        <div className="flex flex-wrap gap-2">
          {templateOptions.length === 0 && (
            <div className="text-gray-400 text-xs mt-1">카테고리를 먼저 선택하세요</div>
          )}
          {templateOptions.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={clsx(
                'px-4 py-2 rounded border shadow-sm bg-white text-left min-w-[220px] max-w-xs overflow-hidden hover:bg-blue-50 transition',
                templateKey === key ? 'border-blue-600 ring-2 ring-blue-200 font-bold' : 'border-gray-300'
              )}
              onClick={() => {
                setTemplateKey(key);
              }}
              disabled={!selectedCustomer}
              title={label}
            >
              <div className="whitespace-pre-line text-sm">
                {label.split('\n').map((line, idx) => (
                  <span key={idx}>{line}{idx < label.split('\n').length - 1 ? <br /> : null}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* 메시지 입력 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">메시지 내용</label>
        {selectedCustomer && (
          <div className="mb-1 text-xs text-gray-600">
            수신자: <b>{selectedCustomer.name}</b> {selectedCustomer.mobile || selectedCustomer.phone ? `(${selectedCustomer.mobile || selectedCustomer.phone})` : ''}
          </div>
        )}
        {selectedCustomer && !selectedCustomer.mobile && (
          <div className="mb-2 text-xs text-red-600 font-semibold">이 고객은 휴대폰 번호가 없어 SMS 발송이 불가합니다.</div>
        )}
        <textarea
          value={message}
          onChange={handleMessageChange}
          rows={6}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="메시지 내용을 입력하세요"
          required
          disabled={!selectedCustomer || !selectedCustomer.mobile}
        />
        <p className="mt-1 text-sm text-gray-500">{message.length}/2000자</p>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !selectedCustomer || !selectedCustomer.mobile}
          className={`px-4 py-2 text-white rounded-md ${loading || !selectedCustomer ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? '처리중...' : 'SMS 발송'}
        </button>
      </div>
    </form>
  );
} 