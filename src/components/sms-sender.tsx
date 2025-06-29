"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/types/database';
import { smsTemplates, SmsTemplateCategory, SmsTemplateKey } from '@/types/sms';
import clsx from 'clsx';
import { Copy } from 'lucide-react';

interface SmsSenderProps {
  selectedCustomer?: Customer | null;
  onSuccess?: () => void;
}

export default function SmsSender({ selectedCustomer, onSuccess }: SmsSenderProps) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<SmsTemplateCategory | ''>('');
  const [templateKey, setTemplateKey] = useState<SmsTemplateKey | ''>('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

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

  // 템플릿 선택 시 메시지 자동 입력
  const handleTemplateSelect = (key: SmsTemplateKey) => {
    setTemplateKey(key);
    if (!category || !key) return;
    const template = smsTemplates[category as SmsTemplateCategory][key];
    setMessage(template);
  };

  const handleCopy = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 카테고리별 템플릿 목록
  const templateOptions = category ? Object.entries(smsTemplates[category as SmsTemplateCategory]) : [];
  // 디버깅용
  // console.log('selectedCustomer:', selectedCustomer);
  // console.log('category:', category);
  // console.log('templateOptions:', templateOptions);

  return (
    <div className="space-y-4">
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
              onClick={() => handleTemplateSelect(key as SmsTemplateKey)}
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
      {/* 메시지 입력 및 복사 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">메시지 내용</label>
        <div className="relative">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
            placeholder="메시지 내용을 입력하세요"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 bg-white border rounded hover:bg-blue-50"
            title="복사"
          >
            <Copy size={18} />
          </button>
        </div>
        {copied && <div className="text-green-600 text-xs mt-1">메시지가 복사되었습니다!</div>}
      </div>
    </div>
  );
} 