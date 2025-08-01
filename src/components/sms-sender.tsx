"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { smsTemplates } from '@/types/sms';
import type { SmsTemplateCategory, SmsTemplateKey } from '@/types/sms';
import clsx from 'clsx';
import { Copy, MessageSquare } from 'lucide-react';

interface SmsSenderProps {
  selectedCustomer?: Customer | null;
  onSuccess?: () => void;
}

type CustomerBase = Database['public']['Tables']['customers']['Row'];
type Customer = CustomerBase & {
  total_unpaid?: number;
  transaction_count?: number;
};

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
    // 반드시 selectedCustomer.name을 직접 치환 (null 체크 추가)
    template = template.replace(/\{고객명\}/g, selectedCustomer.name || '');
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

  const handleSms = () => {
    if (!message || !selectedCustomer) return;
    
    // 전화번호 추출 (mobile 우선, 없으면 phone)
    const phoneNumber = selectedCustomer.mobile || selectedCustomer.phone;
    if (!phoneNumber) return;
    
    // 전화번호에서 숫자만 추출
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // SMS URL scheme 생성
    const smsUrl = `sms:${cleanNumber}?body=${encodeURIComponent(message)}`;
    
    // SMS 앱 열기
    window.location.href = smsUrl;
  };

  // 카테고리별 템플릿 목록
  const templateOptions = category ? Object.entries(smsTemplates[category as SmsTemplateCategory]) : [];
  // 디버깅용
  // console.log('selectedCustomer:', selectedCustomer);
  // console.log('category:', category);
  // console.log('templateOptions:', templateOptions);

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 space-y-8 max-w-3xl w-full mx-auto max-h-[90vh] overflow-y-auto">
      {/* 수신자 선택 섹션 */}
      <div>
        <label className="block text-xl font-bold text-gray-800 mb-4">📱 수신자 선택</label>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
          {selectedCustomer ? (
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 bg-green-500 rounded-full mt-1"></div>
              <div className="flex-1">
                <div className="text-xl font-bold text-gray-800 mb-2">{selectedCustomer.name}</div>
                <div className="space-y-2">
                  {/* 전화번호 영역 */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-700">📞</span>
                    {selectedCustomer.mobile || selectedCustomer.phone ? (
                      <a
                        href={`tel:${(selectedCustomer.mobile || selectedCustomer.phone)?.replace(/[^0-9]/g, '')}`}
                        className="inline-block px-4 py-2 bg-blue-100 border-2 border-blue-300 rounded-lg text-lg font-bold text-blue-700 hover:bg-blue-200 hover:border-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                        title="📞 터치하여 전화 걸기"
                      >
                        {selectedCustomer.mobile || selectedCustomer.phone}
                      </a>
                    ) : (
                      <span className="px-4 py-2 bg-gray-100 border-2 border-gray-300 rounded-lg text-lg font-medium text-gray-400">
                        연락처 없음
                      </span>
                    )}
                  </div>
                  
                  {/* 미수금 영역 */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-700">💰</span>
                    <span className="text-lg font-semibold text-gray-700">
                      미수금: {selectedCustomer.total_unpaid?.toLocaleString() || '0'}원
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-gray-500 text-lg">👆 위의 고객 목록에서 고객을 선택하세요</div>
            </div>
          )}
        </div>
      </div>

      {/* 카테고리 카드 섹션 */}
      <div>
        <label className="block text-xl font-bold text-gray-800 mb-4">📋 카테고리</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.keys(smsTemplates).map(cat => (
            <button
              type="button"
              key={cat}
              className={clsx(
                'px-6 py-4 rounded-xl border-2 shadow-lg bg-white hover:bg-blue-50 transition-all transform hover:scale-105 text-lg font-semibold',
                category === cat ? 'border-blue-600 ring-4 ring-blue-200 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-700'
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
        <label className="block text-xl font-bold text-gray-800 mb-4">💬 메시지 템플릿</label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templateOptions.length === 0 && (
            <div className="col-span-full bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-yellow-600 text-lg font-medium">⚠️ 카테고리를 먼저 선택하세요</div>
            </div>
          )}
          {templateOptions.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={clsx(
                'p-6 rounded-xl border-2 shadow-lg bg-white text-left hover:bg-blue-50 transition-all transform hover:scale-105',
                templateKey === key ? 'border-blue-600 ring-4 ring-blue-200 bg-blue-50' : 'border-gray-300'
              )}
              onClick={() => handleTemplateSelect(key as SmsTemplateKey)}
              title={label}
            >
              <div className="whitespace-pre-line text-base leading-relaxed">
                {label.split('\n').map((line, idx) => (
                  <span key={idx} className={templateKey === key ? 'text-blue-800 font-medium' : 'text-gray-700'}>
                    {line}{idx < label.split('\n').length - 1 ? <br /> : null}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* 메시지 입력 및 액션 버튼 */}
      <div>
        <label className="block text-xl font-bold text-gray-800 mb-4">✉️ 메시지 내용</label>
        <div className="relative">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={8}
            className="block w-full rounded-xl border-2 border-gray-300 shadow-lg focus:border-blue-500 focus:ring-blue-500 pr-32 p-4 text-lg leading-relaxed resize-none"
            placeholder="메시지 내용을 입력하거나 위에서 템플릿을 선택하세요..."
          />
          
          {/* 액션 버튼들 */}
          <div className="absolute top-4 right-4 flex gap-2">
            {/* 복사 버튼 */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
              title="메시지 복사"
            >
              <Copy size={20} />
            </button>
            
            {/* 문자보내기 버튼 */}
            <button
              type="button"
              onClick={handleSms}
              disabled={!message || !selectedCustomer || !(selectedCustomer.mobile || selectedCustomer.phone)}
              className={clsx(
                "p-3 rounded-lg transition-colors shadow-md",
                !message || !selectedCustomer || !(selectedCustomer.mobile || selectedCustomer.phone)
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-green-500 text-white hover:bg-green-600"
              )}
              title={
                !selectedCustomer ? "고객을 선택하세요" :
                !(selectedCustomer.mobile || selectedCustomer.phone) ? "고객의 전화번호가 없습니다" :
                !message ? "메시지를 입력하세요" :
                "문자 보내기"
              }
            >
              <MessageSquare size={20} />
            </button>
          </div>
        </div>
        {copied && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mt-3">
            <div className="text-green-700 text-lg font-medium">✅ 메시지가 클립보드에 복사되었습니다!</div>
          </div>
        )}
        
        {/* 메시지 길이 표시 */}
        <div className="mt-3 text-right">
          <span className={clsx(
            'text-base font-medium',
            message.length > 90 ? 'text-red-600' : message.length > 70 ? 'text-yellow-600' : 'text-gray-600'
          )}>
            {message.length}/90자 {message.length > 90 && '(LMS 요금 적용)'}
          </span>
        </div>
      </div>
    </div>
  );
} 