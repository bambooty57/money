"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { smsTemplates } from '@/types/sms';
import type { SmsTemplateCategory, SmsTemplateKey } from '@/types/sms';
import clsx from 'clsx';
import { Copy, MessageSquare, Plus, Trash2, X, Save, Edit2 } from 'lucide-react';

interface SmsSenderProps {
  selectedCustomer?: Customer | null;
  onSuccess?: () => void;
}

type CustomerBase = Database['public']['Tables']['customers']['Row'];
type Customer = CustomerBase & {
  total_unpaid?: number;
  transaction_count?: number;
};

interface SmsTemplate {
  id: string;
  category: string;
  key: string;
  content: string;
}

export default function SmsSender({ selectedCustomer, onSuccess }: SmsSenderProps) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<SmsTemplateCategory | ''>('');
  const [templateKey, setTemplateKey] = useState<SmsTemplateKey | ''>('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [dbTemplates, setDbTemplates] = useState<Record<string, Record<string, string>>>({});
  const [dbTemplateIds, setDbTemplateIds] = useState<Record<string, Record<string, string>>>({}); // category -> key -> id
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [addFormData, setAddFormData] = useState({ key: '', content: '' });
  const [error, setError] = useState('');

  // DB에서 템플릿 로드
  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await fetch('/api/sms-templates');
      const result = await response.json();
      if (result.data && Array.isArray(result.data)) {
        // DB 템플릿을 카테고리별로 그룹화
        const grouped: Record<string, Record<string, string>> = {};
        const ids: Record<string, Record<string, string>> = {};
        result.data.forEach((template: SmsTemplate) => {
          if (!grouped[template.category]) {
            grouped[template.category] = {};
            ids[template.category] = {};
          }
          grouped[template.category][template.key] = template.content;
          ids[template.category][template.key] = template.id;
        });
        setDbTemplates(grouped);
        setDbTemplateIds(ids);
      }
      // 에러가 있으면 콘솔에만 표시 (하드코딩된 템플릿 사용)
      if (result.error) {
        console.warn('템플릿 로드 경고:', result.error);
      }
    } catch (err) {
      console.error('템플릿 로드 실패:', err);
      // 에러가 발생해도 하드코딩된 템플릿 사용 가능
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

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
    
    // DB 템플릿 우선, 없으면 하드코딩된 템플릿 사용
    let template = dbTemplates[category]?.[templateKey] || 
                   smsTemplates[category as SmsTemplateCategory]?.[templateKey] || '';
    
    if (!template) {
      setMessage('');
      return;
    }
    
    // 반드시 selectedCustomer.name을 직접 치환 (null 체크 추가)
    template = template.replace(/\{고객명\}/g, selectedCustomer.name || '');
    template = template.replace(/\{미수금\}/g, selectedCustomer.total_unpaid?.toLocaleString() ?? '0');
    template = template.replace(/\{거래건수\}/g, String(selectedCustomer.transaction_count ?? 0));
    // 기타 변수는 빈값
    template = template.replace(/\{납부기한\}/g, '');
    template = template.replace(/\{분할금액\}/g, '');
    setMessage(template);
  }, [selectedCustomer, category, templateKey, dbTemplates]);

  // 템플릿 선택 시 메시지 자동 입력
  const handleTemplateSelect = (key: SmsTemplateKey) => {
    setTemplateKey(key);
    if (!category || !key) return;
    const template = dbTemplates[category]?.[key] || 
                     smsTemplates[category as SmsTemplateCategory]?.[key] || '';
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

  const handleAddTemplate = async () => {
    if (!category || !addFormData.key || !addFormData.content) {
      setError('템플릿 키와 내용을 입력해주세요.');
      return;
    }

    try {
      setError(''); // 에러 초기화
      const response = await fetch('/api/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          key: addFormData.key,
          content: addFormData.content
        })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
        console.error('템플릿 추가 에러:', result.error);
      } else {
        setShowAddForm(false);
        setAddFormData({ key: '', content: '' });
        setError('');
        await loadTemplates();
      }
    } catch (err: any) {
      const errorMsg = err?.message || '템플릿 추가에 실패했습니다.';
      setError(errorMsg);
      console.error('템플릿 추가 실패:', err);
    }
  };

  const handleEditTemplate = (key: string) => {
    if (!category) return;
    
    const templateId = dbTemplateIds[category]?.[key];
    if (!templateId) {
      setError('DB에 저장된 템플릿만 수정할 수 있습니다.');
      return;
    }

    const templateContent = dbTemplates[category]?.[key] || '';
    setEditingTemplateId(templateId);
    setAddFormData({ key, content: templateContent });
    setShowAddForm(true);
    setError('');
  };

  const handleUpdateTemplate = async () => {
    if (!category || !editingTemplateId || !addFormData.key || !addFormData.content) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      setError('');
      const response = await fetch('/api/sms-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTemplateId,
          category,
          key: addFormData.key,
          content: addFormData.content
        })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
        console.error('템플릿 수정 에러:', result.error);
      } else {
        setShowAddForm(false);
        setEditingTemplateId(null);
        setAddFormData({ key: '', content: '' });
        setError('');
        await loadTemplates();
      }
    } catch (err: any) {
      const errorMsg = err?.message || '템플릿 수정에 실패했습니다.';
      setError(errorMsg);
      console.error('템플릿 수정 실패:', err);
    }
  };

  const handleDeleteTemplate = async (key: string) => {
    if (!category) {
      setError('카테고리를 선택해주세요.');
      return;
    }
    
    const templateId = dbTemplateIds[category]?.[key];
    console.log('삭제 시도:', { category, key, templateId, dbTemplateIds });
    
    if (!templateId) {
      setError('DB에 저장된 템플릿만 삭제할 수 있습니다. (하드코딩된 템플릿은 삭제할 수 없습니다)');
      return;
    }

    if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError(''); // 에러 초기화
      const response = await fetch(`/api/sms-templates?id=${templateId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      console.log('삭제 응답:', result);
      
      if (result.error) {
        setError(result.error);
        console.error('템플릿 삭제 에러:', result.error);
      } else {
        setError('');
        if (templateKey === key) {
          setTemplateKey('');
          setMessage('');
        }
        await loadTemplates();
      }
    } catch (err: any) {
      const errorMsg = err?.message || '템플릿 삭제에 실패했습니다.';
      setError(errorMsg);
      console.error('템플릿 삭제 실패:', err);
    }
  };

  // 카테고리별 템플릿 목록 (DB 템플릿 우선, 없으면 하드코딩된 템플릿 사용)
  const templateOptions = category ? Object.entries(
    dbTemplates[category] || smsTemplates[category as SmsTemplateCategory] || {}
  ) : [];
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
          {(Object.keys(dbTemplates).length > 0 ? Object.keys(dbTemplates) : Object.keys(smsTemplates)).map(cat => (
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
        <div className="flex justify-between items-center mb-4">
          <label className="block text-xl font-bold text-gray-800">💬 메시지 템플릿</label>
          {category && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setEditingTemplateId(null);
                setAddFormData({ key: '', content: '' });
                setError('');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Plus size={18} />
              템플릿 추가
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 text-sm">
            <div className="font-semibold mb-1">⚠️ 오류</div>
            <div className="whitespace-pre-line">{error}</div>
            {error.includes('sms_templates 테이블') && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-yellow-800 text-xs">
                💡 해결 방법: Supabase SQL Editor에서 <code className="bg-white px-1 rounded">sql/create_sms_templates_table.sql</code> 파일의 내용을 실행하세요.
              </div>
            )}
          </div>
        )}

        {/* 템플릿 추가/수정 폼 */}
        {showAddForm && category && (
          <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-800">
                {editingTemplateId ? '템플릿 수정' : '새 템플릿 추가'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingTemplateId(null);
                  setAddFormData({ key: '', content: '' });
                  setError('');
                }}
                className="p-1 text-gray-600 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">템플릿 키 (고유 식별자)</label>
                <input
                  type="text"
                  value={addFormData.key}
                  onChange={(e) => setAddFormData({ ...addFormData, key: e.target.value })}
                  placeholder="예: 구보다_새템플릿"
                  disabled={!!editingTemplateId}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">메시지 내용</label>
                <textarea
                  value={addFormData.content}
                  onChange={(e) => setAddFormData({ ...addFormData, content: e.target.value })}
                  placeholder="메시지 내용을 입력하세요. {고객명}, {미수금}, {거래건수} 등의 변수를 사용할 수 있습니다."
                  rows={4}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
                <div className="mt-1 text-xs text-gray-500">
                  사용 가능한 변수: {'{고객명}'}, {'{미수금}'}, {'{거래건수}'}, {'{납부기한}'}, {'{분할금액}'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={editingTemplateId ? handleUpdateTemplate : handleAddTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save size={16} />
                  {editingTemplateId ? '저장' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTemplateId(null);
                    setAddFormData({ key: '', content: '' });
                    setError('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <X size={16} />
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templateOptions.length === 0 && !showAddForm && (
            <div className="col-span-full bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-yellow-600 text-lg font-medium">⚠️ 카테고리를 먼저 선택하세요</div>
            </div>
          )}
          {templateOptions.map(([key, label]) => {
            const isDbTemplate = !!dbTemplateIds[category]?.[key];
            return (
              <div
                key={key}
                className={clsx(
                  'relative p-6 rounded-xl border-2 shadow-lg bg-white transition-all transform hover:scale-105',
                  templateKey === key ? 'border-blue-600 ring-4 ring-blue-200 bg-blue-50' : 'border-gray-300'
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => handleTemplateSelect(key as SmsTemplateKey)}
                  title={label}
                >
                  <div className="whitespace-pre-line text-base leading-relaxed pr-8">
                    {/* \n을 실제 줄바꿈으로 처리 */}
                    {label.replace(/\\n/g, '\n').split('\n').map((line, idx, arr) => (
                      <span key={idx} className={templateKey === key ? 'text-blue-800 font-medium' : 'text-gray-700'}>
                        {line}{idx < arr.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </div>
                </button>
                {/* 수정/삭제 버튼 (DB 템플릿만) */}
                {isDbTemplate && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(key);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="템플릿 수정"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(key);
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="템플릿 삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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