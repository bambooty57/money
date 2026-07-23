"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { SmsTemplateCategory, SmsTemplateKey } from '@/types/sms';
import clsx from 'clsx';
import { Copy, Loader2, MessageSquare, Plus, Trash2, X, Save, Edit2 } from 'lucide-react';

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
  const [solapiSuccess, setSolapiSuccess] = useState(false);

  // DB에서 템플릿 로드
  const loadTemplates = async (): Promise<{ grouped: Record<string, Record<string, string>>; ids: Record<string, Record<string, string>> } | null> => {
    try {
      setTemplatesLoading(true);
      const response = await fetch('/api/sms-templates');
      
      if (!response.ok) {
        throw new Error(`템플릿 로드 실패: ${response.status} ${response.statusText}`);
      }
      
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

        // 현재 선택된 템플릿이 여전히 유효한지 확인
        const currentTemplateExists = category && templateKey 
          ? grouped[category]?.[templateKey] !== undefined
          : false;
        
        // 템플릿 상태 업데이트
        setDbTemplates(grouped);
        setDbTemplateIds(ids);
        
        // 현재 선택된 템플릿이 더 이상 존재하지 않으면 상태 초기화
        if (category && templateKey && !currentTemplateExists) {
          console.warn('현재 선택된 템플릿이 더 이상 존재하지 않습니다:', { category, templateKey });
          setTemplateKey('');
          setMessage('');
        }
        
        return { grouped, ids };
      } else {
        console.warn('템플릿 데이터가 없거나 배열이 아닙니다:', result);
        // 데이터가 없으면 초기화
        setDbTemplates({});
        setDbTemplateIds({});
        // 현재 선택된 템플릿이 있으면 초기화
        if (templateKey) {
          setTemplateKey('');
          setMessage('');
        }
        return null;
      }
      // 에러가 있으면 콘솔에만 표시
      if (result.error) {
        console.warn('템플릿 로드 경고:', result.error);
      }
    } catch (err) {
      console.error('템플릿 로드 실패:', err);
      // 에러가 발생하면 초기화
      setDbTemplates({});
      setDbTemplateIds({});
      // 현재 선택된 템플릿이 있으면 초기화
      if (templateKey) {
        setTemplateKey('');
        setMessage('');
      }
      return null;
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
    if (!category || !templateKey) {
      setMessage('');
      return;
    }
    
    // DB 템플릿만 사용 (하드코딩된 템플릿은 DB에 저장 후 사용)
    let template = dbTemplates[category]?.[templateKey] || '';
    
    if (!template) {
      console.warn('템플릿을 찾을 수 없습니다:', { category, templateKey, availableKeys: Object.keys(dbTemplates[category] || {}) });
      setMessage('');
      return;
    }
    
    // selectedCustomer가 있으면 변수 치환, 없으면 템플릿 내용만 표시
    if (selectedCustomer) {
      // 반드시 selectedCustomer.name을 직접 치환 (null 체크 추가)
      template = template.replace(/\{고객명\}/g, selectedCustomer.name || '');
      template = template.replace(/\{미수금\}/g, selectedCustomer.total_unpaid?.toLocaleString() ?? '0');
      template = template.replace(/\{거래건수\}/g, String(selectedCustomer.transaction_count ?? 0));
      // 기타 변수는 빈값
      template = template.replace(/\{납부기한\}/g, '');
      template = template.replace(/\{분할금액\}/g, '');
    } else {
      // 고객이 선택되지 않았으면 변수는 그대로 표시
      // (나중에 고객을 선택하면 자동으로 치환됨)
    }
    
    // \n을 실제 줄바꿈으로 변환 (DB에 문자열로 저장된 \n을 실제 줄바꿈 문자로 변환)
    template = template.replace(/\\n/g, '\n');
    
    setMessage(template);
  }, [selectedCustomer, category, templateKey, dbTemplates]);

  // 템플릿 선택 시 메시지 자동 입력
  const handleTemplateSelect = (key: SmsTemplateKey) => {
    // 템플릿 키 설정
    setTemplateKey(key);

    // 즉시 메시지 생성 (useEffect가 실행되기 전에 미리 생성)
    if (category && dbTemplates[category]?.[key]) {
      let template = dbTemplates[category][key];

      // selectedCustomer가 있으면 변수 치환
      if (selectedCustomer) {
        template = template.replace(/\{고객명\}/g, selectedCustomer.name || '');
        template = template.replace(/\{미수금\}/g, selectedCustomer.total_unpaid?.toLocaleString() ?? '0');
        template = template.replace(/\{거래건수\}/g, String(selectedCustomer.transaction_count ?? 0));
        template = template.replace(/\{납부기한\}/g, '');
        template = template.replace(/\{분할금액\}/g, '');
      }

      // \n을 실제 줄바꿈으로 변환
      template = template.replace(/\\n/g, '\n');

      setMessage(template);
    } else {
      console.warn('템플릿을 찾을 수 없습니다:', { category, key, availableTemplates: Object.keys(dbTemplates[category] || {}) });
      // useEffect가 처리하도록 함
    }
  };

  const handleCopy = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSms = async () => {
    if (!message || !selectedCustomer) return;

    // 전화번호 추출 (mobile 우선, 없으면 phone)
    const phoneNumber = selectedCustomer.mobile || selectedCustomer.phone;
    if (!phoneNumber) return;

    setLoading(true);
    setError('');
    setSolapiSuccess(false);

    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          message,
          customerId: selectedCustomer.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || `SMS 발송 실패 (${response.status})`);
        return;
      }

      setSolapiSuccess(true);
      setTimeout(() => setSolapiSuccess(false), 3000);

      if (onSuccess) onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'SMS 발송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!category || !addFormData.content) {
      setError('메시지 내용을 입력해주세요.');
      return;
    }

    // 템플릿 키가 비어있으면 자동 생성 (타임스탬프 기반)
    let templateKey = addFormData.key.trim();
    if (!templateKey) {
      // 타임스탬프를 기반으로 고유한 키 생성
      templateKey = `template_${Date.now()}`;
    }

    try {
      setError(''); // 에러 초기화
      
      // Supabase 세션에서 액세스 토큰 가져오기
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('로그인이 필요합니다.');
        return;
      }
      
      const response = await fetch('/api/sms-templates', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          category,
          key: templateKey,
          content: addFormData.content
        })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
        console.error('템플릿 추가 에러:', result.error);
      } else {
        const newKey = templateKey;
        const newContent = addFormData.content; // 추가된 템플릿 내용 저장
        setShowAddForm(false);
        setAddFormData({ key: '', content: '' });
        setError('');
        // 템플릿 목록 새로고침
        const loadedData = await loadTemplates();
        // 새로 추가된 템플릿을 자동으로 선택하여 메시지 생성
        if (loadedData && loadedData.grouped[category]?.[newKey]) {
          // loadTemplates가 반환한 데이터를 직접 사용하여 메시지 생성
          const templateContent = loadedData.grouped[category][newKey];
          
          // 템플릿 키 설정 (useEffect가 메시지를 생성하도록 함)
          setTemplateKey(newKey);
          
          // selectedCustomer가 있으면 변수 치환하여 메시지 생성
          if (selectedCustomer) {
            let message = templateContent;
            message = message.replace(/\{고객명\}/g, selectedCustomer.name || '');
            message = message.replace(/\{미수금\}/g, selectedCustomer.total_unpaid?.toLocaleString() ?? '0');
            message = message.replace(/\{거래건수\}/g, String(selectedCustomer.transaction_count ?? 0));
            message = message.replace(/\{납부기한\}/g, '');
            message = message.replace(/\{분할금액\}/g, '');
            message = message.replace(/\\n/g, '\n');
            setMessage(message);
          } else {
            // 고객이 선택되지 않았으면 템플릿 내용만 표시 (변수 치환 없이)
            setMessage(templateContent.replace(/\\n/g, '\n'));
          }
        } else {
          console.warn('새 템플릿을 찾을 수 없습니다:', { category, newKey, loadedData });
          // 템플릿을 찾을 수 없어도 직접 메시지 설정 시도
          if (selectedCustomer) {
            // 변수 치환하여 메시지 생성
            let message = newContent;
            message = message.replace(/\{고객명\}/g, selectedCustomer.name || '');
            message = message.replace(/\{미수금\}/g, selectedCustomer.total_unpaid?.toLocaleString() ?? '0');
            message = message.replace(/\{거래건수\}/g, String(selectedCustomer.transaction_count ?? 0));
            message = message.replace(/\{납부기한\}/g, '');
            message = message.replace(/\{분할금액\}/g, '');
            message = message.replace(/\\n/g, '\n');
            setMessage(message);
            setTemplateKey(newKey);
          } else {
            // 고객이 없으면 템플릿 내용만 표시
            setMessage(newContent.replace(/\\n/g, '\n'));
            setTemplateKey(newKey);
          }
        }
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
    if (!category || !editingTemplateId || !addFormData.content) {
      setError('메시지 내용을 입력해주세요.');
      return;
    }

    // 템플릿 키가 비어있으면 기존 키 유지
    const templateKey = addFormData.key.trim() || dbTemplates[category] ? Object.keys(dbTemplates[category]).find(k => dbTemplateIds[category]?.[k] === editingTemplateId) || '' : '';
    
    if (!templateKey) {
      setError('템플릿 키를 찾을 수 없습니다.');
      return;
    }

    try {
      setError('');
      
      // Supabase 세션에서 액세스 토큰 가져오기
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('로그인이 필요합니다.');
        return;
      }
      
      const response = await fetch('/api/sms-templates', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: editingTemplateId,
          category,
          key: templateKey,
          content: addFormData.content
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        setError(errorData.error || `템플릿 수정 실패 (${response.status})`);
        console.error('템플릿 수정 HTTP 에러:', { status: response.status, error: errorData });
        return;
      }
      
      const result = await response.json();
      if (result.error) {
        setError(result.error);
        console.error('템플릿 수정 에러:', result.error);
      } else if (result.data) {
        const updatedKey = templateKey;
        const wasSelected = templateKey === updatedKey;
        setShowAddForm(false);
        setEditingTemplateId(null);
        setAddFormData({ key: '', content: '' });
        setError('');
        // 템플릿 목록 새로고침
        await loadTemplates();
        // 수정된 템플릿이 현재 선택된 템플릿이었다면 메시지 다시 생성
        if (wasSelected) {
          setTimeout(() => {
            setTemplateKey(updatedKey);
          }, 100);
        }
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

    if (!templateId) {
      setError('DB에 저장된 템플릿만 삭제할 수 있습니다.');
      console.warn('템플릿 ID를 찾을 수 없습니다:', { category, key, dbTemplateIds });
      return;
    }

    if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setError(''); // 에러 초기화
      
      // Supabase 세션에서 액세스 토큰 가져오기
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('로그인이 필요합니다.');
        return;
      }
      
      const response = await fetch(`/api/sms-templates?id=${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        setError(errorData.error || `템플릿 삭제 실패 (${response.status})`);
        console.error('템플릿 삭제 HTTP 에러:', { status: response.status, error: errorData, templateId, key });
        // 에러 발생 시에도 목록 새로고침하여 최신 상태 확인
        await loadTemplates();
        return;
      }

      const result = await response.json();

      if (result.error) {
        setError(result.error);
        console.error('템플릿 삭제 에러:', result.error);
        await loadTemplates();
        return; // 에러 발생 시 중단
      } else if (result.success && result.deleted && result.deleted.length > 0) {
        // 삭제된 템플릿이 현재 선택된 템플릿이었다면 상태 초기화
        if (templateKey === key) {
          setTemplateKey('');
          setMessage('');
        }
        
        // 즉시 로컬 상태에서 템플릿 제거 (낙관적 업데이트)
        setDbTemplates(prev => {
          const updated = { ...prev };
          if (updated[category]) {
            updated[category] = { ...updated[category] };
            delete updated[category][key];
            // 카테고리가 비어있으면 카테고리 자체도 제거
            if (Object.keys(updated[category]).length === 0) {
              delete updated[category];
            }
          }
          return updated;
        });
        
        setDbTemplateIds(prev => {
          const updated = { ...prev };
          if (updated[category]) {
            updated[category] = { ...updated[category] };
            delete updated[category][key];
            // 카테고리가 비어있으면 카테고리 자체도 제거
            if (Object.keys(updated[category]).length === 0) {
              delete updated[category];
            }
          }
          return updated;
        });
        
        setError('');
        // 템플릿 목록 새로고침 (서버에서 최신 데이터 가져오기)
        await loadTemplates();
      } else {
        // 삭제가 실제로 이루어지지 않음
        const errorMsg = result.error || '템플릿을 삭제할 수 없습니다. 권한이 없거나 이미 삭제되었을 수 있습니다.';
        setError(errorMsg);
        console.error('삭제 실패:', { result, templateId, key, category });
        // 삭제 실패 시에도 목록 새로고침하여 최신 상태 확인
        await loadTemplates();
      }
    } catch (err: any) {
      const errorMsg = err?.message || '템플릿 삭제에 실패했습니다.';
      setError(errorMsg);
      console.error('템플릿 삭제 실패:', err);
    }
  };

  // 카테고리별 템플릿 목록 (DB 템플릿만 사용, 하드코딩된 템플릿은 DB에 저장 후 사용)
  const templateOptions = category ? Object.entries(
    dbTemplates[category] || {}
  ) : [];

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
          {(['미수금 독촉', '상환/입금 안내', '분할납부/약정', '법적 조치/최종', '감사/일상', '기타'] as SmsTemplateCategory[]).map(cat => (
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  템플릿 이름 {!editingTemplateId && <span className="text-xs text-gray-500">(선택사항, 자동 생성됨)</span>}
                </label>
                <input
                  type="text"
                  value={addFormData.key}
                  onChange={(e) => setAddFormData({ ...addFormData, key: e.target.value })}
                  placeholder={editingTemplateId ? "템플릿 이름을 입력하세요" : "비워두면 자동으로 생성됩니다"}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                />
                <div className="mt-1 text-xs text-gray-500">
                  {!editingTemplateId && "💡 템플릿 이름을 비워두면 메시지 내용의 첫 줄을 기반으로 자동 생성됩니다."}
                  {editingTemplateId && "템플릿 이름을 변경하면 기존 템플릿이 새 이름으로 업데이트됩니다."}
                </div>
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
          {!category && (
            <div className="col-span-full bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-yellow-600 text-lg font-medium">⚠️ 카테고리를 먼저 선택하세요</div>
            </div>
          )}
          {category && templateOptions.length === 0 && !showAddForm && (
            <div className="col-span-full bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-yellow-600 text-lg font-medium">
                ⚠️ {category} 카테고리에 템플릿이 없습니다. 템플릿을 추가해주세요.
              </div>
            </div>
          )}
          {templateOptions.map(([key, label]) => {
            // DB 템플릿만 표시되므로 모든 템플릿에 수정/삭제 버튼 표시
            const templateId = dbTemplateIds[category]?.[key];
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
                  <div className="whitespace-pre-line text-base leading-relaxed pr-16">
                    {/* \n을 실제 줄바꿈으로 처리 */}
                    {label.replace(/\\n/g, '\n').split('\n').map((line, idx, arr) => (
                      <span key={idx} className={templateKey === key ? 'text-blue-800 font-medium' : 'text-gray-700'}>
                        {line}{idx < arr.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </div>
                </button>
                {/* 수정/삭제 버튼 (모든 DB 템플릿에 표시) */}
                {templateId && (
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
            className="block w-full rounded-xl border-2 border-gray-300 shadow-lg focus:border-blue-500 focus:ring-blue-500 pr-32 p-4 text-lg leading-relaxed resize-none whitespace-pre-wrap"
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
              disabled={!message || !selectedCustomer || !(selectedCustomer.mobile || selectedCustomer.phone) || loading}
              className={clsx(
                "p-3 rounded-lg transition-colors shadow-md",
                !message || !selectedCustomer || !(selectedCustomer.mobile || selectedCustomer.phone) || loading
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-green-500 text-white hover:bg-green-600"
              )}
              title={
                loading ? "발송 중..." :
                !selectedCustomer ? "고객을 선택하세요" :
                !(selectedCustomer.mobile || selectedCustomer.phone) ? "고객의 전화번호가 없습니다" :
                !message ? "메시지를 입력하세요" :
                "문자 보내기"
              }
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <MessageSquare size={20} />}
            </button>
          </div>
        </div>
        {copied && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mt-3">
            <div className="text-green-700 text-lg font-medium">✅ 메시지가 클립보드에 복사되었습니다!</div>
          </div>
        )}

        {solapiSuccess && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mt-3">
            <div className="text-green-700 text-lg font-medium">✅ SMS가 성공적으로 발송되었습니다!</div>
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