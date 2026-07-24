"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Pagination, usePagination } from '@/components/ui/pagination';
import type { Database } from '@/types/database';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useCustomersRealtime } from '@/lib/useCustomersRealtime';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// 가망고객 타입 정의
type Prospect = {
  id: string;
  customer_id: string;
  prospect_device_type: '트랙터' | '콤바인' | '이앙기' | '작업기' | '기타';
  prospect_device_model: string[] | null;
  current_device_model: string | null;
  current_device_model_id: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

const DEVICE_TYPES = ['트랙터', '콤바인', '이앙기', '작업기', '기타'] as const;

const DEVICE_ICONS: Record<string, string> = {
  트랙터: '🚜',
  콤바인: '🌾',
  이앙기: '🌱',
  작업기: '⚙️',
  기타: '📦',
};

const DEVICE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  트랙터: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  콤바인: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  이앙기: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
  작업기: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' },
  기타: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' },
};

// 디바운싱 유틸리티 함수
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 검색 히스토리 관리
interface SearchHistory {
  customerId: string;
  name: string;
  searchCount: number;
  lastSearched: Date;
}

type CustomerBase = Database['public']['Tables']['customers']['Row'];
type Customer = CustomerBase & {
  transaction_count?: number;
  total_unpaid?: number;
  photos?: { url: string }[];
};

interface ApiResponse {
  data: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    search: string;
    sortBy: string;
    sortOrder: string;
    itemsOnPage: number;
  };
}

interface PaginatedCustomerListProps {
  onEdit?: (customer: Customer) => void;
  onDelete?: (id: string) => void;
  enableActions?: boolean;
  onSelectCustomer?: (customer: Customer | null) => void;
  refreshKey?: number;
}

const openKakaoMap = (address: string) => {
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
  window.open(kakaoMapUrl, '_blank');
};

function CustomerDetailModal({ customer, open, onClose }: { customer: any, open: boolean, onClose: () => void }) {
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 가망고객 관련 상태
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  
  // 가망고객 폼 상태
  const [formDeviceType, setFormDeviceType] = useState<string>('트랙터');
  const [formProspectModel, setFormProspectModel] = useState('');
  const [formCurrentModel, setFormCurrentModel] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // 발송내역 fetch
  useEffect(() => {
    if (open && customer?.id) {
      setLoading(true);
      fetch(`/api/sms-messages?customer_id=${customer.id}`)
        .then(res => res.json())
        .then(data => setSmsMessages(data.data || []))
        .finally(() => setLoading(false));
    }
  }, [open, customer]);

  // 가망고객 목록 조회
  const fetchProspects = useCallback(async () => {
    if (!customer?.id) return;
    setProspectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_prospects')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('가망고객 조회 오류:', error);
      } else {
        // 타입 단언: Supabase에서 가져온 데이터를 Prospect 타입으로 변환
        setProspects((data || []) as Prospect[]);
      }
    } catch (error) {
      console.error('가망고객 조회 실패:', error);
    } finally {
      setProspectsLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    if (open && customer?.id) {
      fetchProspects();
    }
  }, [open, customer?.id, fetchProspects]);

  // 폼 초기화
  const resetForm = () => {
    setFormDeviceType('트랙터');
    setFormProspectModel('');
    setFormCurrentModel('');
    setFormMemo('');
    setShowAddForm(false);
    setEditingProspect(null);
  };

  // 수정 모드 시작
  const handleEditClick = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setFormDeviceType(prospect.prospect_device_type);
    setFormProspectModel(prospect.prospect_device_model?.join(', ') || '');
    setFormCurrentModel(prospect.current_device_model || '');
    setFormMemo(prospect.memo || '');
    setShowAddForm(true);
  };

  // 가망고객 저장 (추가/수정)
  const handleSaveProspect = async () => {
    if (!customer?.id) return;
    setFormSaving(true);
    
    try {
      if (editingProspect) {
        // 수정: customer_id는 제외하고, editingProspect.id 유효성 확인
        if (!editingProspect.id) {
          throw new Error('수정할 가망고객 정보의 ID가 없습니다.');
        }
        
        const updateData = {
          prospect_device_type: formDeviceType as '트랙터' | '콤바인' | '이앙기' | '작업기' | '기타',
          prospect_device_model: formProspectModel ? formProspectModel.split(',').map(m => m.trim()).filter(m => m) : null,
          current_device_model: formCurrentModel || null,
          memo: formMemo || null,
          updated_at: new Date().toISOString(),
        };
        
        console.log('🔍 가망고객 수정:', { id: editingProspect.id, updateData });
        
        const { error } = await supabase
          .from('customer_prospects')
          .update(updateData)
          .eq('id', editingProspect.id);

        if (error) {
          console.error('❌ 가망고객 수정 실패:', error);
          throw error;
        }
        alert('가망고객 정보가 수정되었습니다.');
      } else {
        // 추가
        const insertData = {
          customer_id: customer.id,
          prospect_device_type: formDeviceType as '트랙터' | '콤바인' | '이앙기' | '작업기' | '기타',
          prospect_device_model: formProspectModel ? formProspectModel.split(',').map(m => m.trim()).filter(m => m) : null,
          current_device_model: formCurrentModel || null,
          memo: formMemo || null,
        };
        
        console.log('🔍 가망고객 추가:', insertData);
        
        const { error } = await supabase
          .from('customer_prospects')
          .insert(insertData);

        if (error) {
          console.error('❌ 가망고객 추가 실패:', error);
          throw error;
        }
        alert('가망고객 정보가 추가되었습니다.');
      }

      resetForm();
      fetchProspects();
    } catch (error: any) {
      console.error('가망고객 저장 실패:', error);
      const errorMessage = error.message || error.details || '알 수 없는 오류';
      alert(`저장 실패: ${errorMessage}`);
    } finally {
      setFormSaving(false);
    }
  };

  // 가망고객 삭제
  const handleDeleteProspect = async (prospectId: string) => {
    if (!confirm('이 가망고객 정보를 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('customer_prospects')
        .delete()
        .eq('id', prospectId);

      if (error) throw error;
      alert('삭제되었습니다.');
      fetchProspects();
    } catch (error: any) {
      console.error('가망고객 삭제 실패:', error);
      alert('삭제 실패: ' + (error.message || '알 수 없는 오류'));
    }
  };

  if (!customer) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-800 flex items-center gap-3">
            👤 {customer.name} 상세정보
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
            <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
              📋 기본 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-blue-700 block mb-1">고객명</span>
                <span className="text-lg font-bold text-blue-800">{customer.name}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-blue-700 block mb-1">고객유형</span>
                <span className="text-lg font-semibold text-blue-800">
                  {Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? 
                    customer.customer_type_multi.join(', ') : 
                    customer.customer_type || '-'
                  }
                </span>
              </div>
              {customer.business_name && (
                <div>
                  <span className="text-sm font-semibold text-blue-700 block mb-1">사업자명</span>
                  <span className="text-lg font-semibold text-blue-800">{customer.business_name}</span>
                </div>
              )}
              {customer.representative_name && (
                <div>
                  <span className="text-sm font-semibold text-blue-700 block mb-1">대표자명</span>
                  <span className="text-lg font-semibold text-blue-800">{customer.representative_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* 연락처 정보 */}
          <div className="bg-indigo-50 p-6 rounded-lg border-2 border-indigo-200">
            <h3 className="text-xl font-bold text-indigo-800 mb-4 flex items-center gap-2">
              📞 연락처 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customer.mobile && (
                <div>
                  <span className="text-sm font-semibold text-indigo-700 block mb-2">휴대폰</span>
                  <a
                    href={`tel:${customer.mobile.replace(/[^0-9]/g, '')}`}
                    className="inline-block px-4 py-2 bg-indigo-100 border-2 border-indigo-300 rounded-lg text-lg font-bold text-indigo-700 hover:bg-indigo-200 hover:border-indigo-500 transition-all duration-200 shadow-md hover:shadow-lg"
                    title="📞 터치하여 전화 걸기"
                  >
                    {customer.mobile}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div>
                  <span className="text-sm font-semibold text-indigo-700 block mb-2">일반전화</span>
                  <a
                    href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                    className="inline-block px-4 py-2 bg-indigo-100 border-2 border-indigo-300 rounded-lg text-lg font-bold text-indigo-700 hover:bg-indigo-200 hover:border-indigo-500 transition-all duration-200 shadow-md hover:shadow-lg"
                    title="📞 터치하여 전화 걸기"
                  >
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.fax && (
                <div>
                  <span className="text-sm font-semibold text-indigo-700 block mb-1">팩스</span>
                  <span className="text-lg text-indigo-800">{customer.fax}</span>
                </div>
              )}
            </div>
          </div>

          {/* 주소 정보 */}
          <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
            <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-2">
              🏠 주소 정보
            </h3>
            <div className="space-y-3">
              {customer.address_road && (
                <div>
                  <span className="text-sm font-semibold text-green-700 block mb-1">도로명주소</span>
                  <button
                    onClick={() => openKakaoMap(customer.address_road!)}
                    className="text-lg text-green-600 underline hover:text-green-800 font-medium text-left block"
                    style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                    title="카카오맵에서 보기"
                  >
                    {customer.address_road}
                  </button>
                </div>
              )}
              {customer.address_jibun && (
                <div>
                  <span className="text-sm font-semibold text-green-700 block mb-1">지번주소</span>
                  <button
                    onClick={() => openKakaoMap(customer.address_jibun!)}
                    className="text-lg text-green-600 underline hover:text-green-800 font-medium text-left block"
                    style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                    title="카카오맵에서 보기"
                  >
                    {customer.address_jibun}
                  </button>
                </div>
              )}
              {customer.zipcode && (
                <div>
                  <span className="text-sm font-semibold text-green-700 block mb-1">우편번호</span>
                  <span className="text-lg text-green-800">{customer.zipcode}</span>
                </div>
              )}
            </div>
          </div>

          {/* 🎯 가망고객 정보 */}
          <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-orange-800 flex items-center gap-2">
                🎯 가망고객 정보 ({prospects.length}건)
              </h3>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-bold text-lg flex items-center gap-2"
                >
                  ➕ 추가
                </button>
              )}
            </div>

            {/* 추가/수정 폼 */}
            {showAddForm && (
              <div className="bg-white p-5 rounded-lg border-2 border-orange-200 mb-4">
                <h4 className="text-lg font-bold text-orange-700 mb-4">
                  {editingProspect ? '✏️ 가망고객 수정' : '➕ 가망고객 추가'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 희망 기종 */}
                  <div>
                    <label className="block text-base font-bold text-orange-700 mb-2">희망 기종 *</label>
                    <select
                      value={formDeviceType}
                      onChange={(e) => setFormDeviceType(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      title="희망 기종 선택"
                    >
                      {DEVICE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {DEVICE_ICONS[type]} {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 희망 모델 */}
                  <div>
                    <label className="block text-base font-bold text-orange-700 mb-2">희망 모델</label>
                    <input
                      type="text"
                      value={formProspectModel}
                      onChange={(e) => setFormProspectModel(e.target.value)}
                      placeholder="예: M7131, M6040 (쉼표로 구분)"
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                  </div>

                  {/* 현재 보유 기종 */}
                  <div>
                    <label className="block text-base font-bold text-orange-700 mb-2">현재 보유 기종</label>
                    <input
                      type="text"
                      value={formCurrentModel}
                      onChange={(e) => setFormCurrentModel(e.target.value)}
                      placeholder="예: 대동 DK551"
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                  </div>

                  {/* 메모 */}
                  <div>
                    <label className="block text-base font-bold text-orange-700 mb-2">메모</label>
                    <input
                      type="text"
                      value={formMemo}
                      onChange={(e) => setFormMemo(e.target.value)}
                      placeholder="추가 정보 입력"
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4 justify-end">
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-bold text-lg"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveProspect}
                    disabled={formSaving}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {formSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        저장 중...
                      </>
                    ) : (
                      <>💾 {editingProspect ? '수정' : '저장'}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 가망고객 목록 */}
            {prospectsLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-600 border-t-transparent mx-auto mb-2"></div>
                <div className="text-orange-600">불러오는 중...</div>
              </div>
            ) : prospects.length === 0 ? (
              <div className="text-center py-6 text-gray-500 bg-white rounded-lg border border-orange-200">
                등록된 가망고객 정보가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {prospects.map((prospect) => {
                  const colors = DEVICE_COLORS[prospect.prospect_device_type] || DEVICE_COLORS['기타'];
                  const icon = DEVICE_ICONS[prospect.prospect_device_type] || '📦';
                  return (
                    <div
                      key={prospect.id}
                      className={`${colors.bg} p-4 rounded-lg border-2 ${colors.border}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{icon}</span>
                            <span className={`text-lg font-bold ${colors.text}`}>
                              {prospect.prospect_device_type}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(prospect.created_at).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                          {prospect.prospect_device_model && prospect.prospect_device_model.length > 0 && (
                            <div className="text-base mb-1">
                              <span className="font-semibold text-gray-700">희망 모델:</span>{' '}
                              <span className="text-gray-800">{prospect.prospect_device_model.join(', ')}</span>
                            </div>
                          )}
                          {prospect.current_device_model && (
                            <div className="text-base mb-1">
                              <span className="font-semibold text-gray-700">현재 보유:</span>{' '}
                              <span className="text-gray-800">{prospect.current_device_model}</span>
                            </div>
                          )}
                          {prospect.memo && (
                            <div className="text-base">
                              <span className="font-semibold text-gray-700">메모:</span>{' '}
                              <span className="text-gray-600">{prospect.memo}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditClick(prospect)}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold text-sm"
                          >
                            ✏️ 수정
                          </button>
                          <button
                            onClick={() => handleDeleteProspect(prospect.id)}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-bold text-sm"
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 거래 정보 */}
          <div className="bg-purple-50 p-6 rounded-lg border-2 border-purple-200">
            <h3 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-2">
              💼 거래 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-purple-700 block mb-1">거래건수</span>
                <span className="text-2xl font-bold text-purple-800">{customer.transaction_count ?? 0}건</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-purple-700 block mb-1">미수금</span>
                <span className={`text-2xl font-bold ${customer.total_unpaid && customer.total_unpaid > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {customer.total_unpaid?.toLocaleString() ?? '0'}원
                </span>
              </div>
            </div>
          </div>

          {/* 사진 정보 */}
          {customer.photos && customer.photos.length > 0 && (
            <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                📷 고객 사진
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {customer.photos.map((photo: any, idx: number) => (
                  <img
                    key={idx}
                    src={photo.url}
                    alt="고객사진"
                    className="w-full h-32 rounded-lg object-cover cursor-pointer hover:opacity-80 border-2 border-gray-300 shadow-sm"
                    onClick={() => window.open(photo.url, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 메모 */}
          {customer.memo && (
            <div className="bg-indigo-50 p-6 rounded-lg border-2 border-indigo-200">
              <h3 className="text-xl font-bold text-indigo-800 mb-4 flex items-center gap-2">
                📝 메모
              </h3>
              <p className="text-base text-gray-800 whitespace-pre-wrap break-words bg-white p-4 rounded-lg border border-indigo-200">
                {customer.memo}
              </p>
            </div>
          )}

          {/* SMS 발송 내역 */}
          <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
            <h3 className="text-xl font-bold text-yellow-800 mb-4 flex items-center gap-2">
              📱 SMS 발송 내역
            </h3>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-600 border-t-transparent mx-auto mb-2"></div>
                <div className="text-yellow-600">발송 내역을 불러오는 중...</div>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {smsMessages.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">발송 내역이 없습니다</div>
                ) : (
                  <ul className="space-y-2">
                    {smsMessages.map((msg, i) => (
                      <li key={i} className="bg-white p-3 rounded border border-yellow-200">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-semibold text-yellow-700">
                            {msg.sent_at?.slice(0, 16).replace('T', ' ')}
                          </span>
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            발송됨
                          </span>
                        </div>
                        <div className="text-gray-800">{msg.content}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaginatedCustomerListInner({ 
  onEdit, 
  onDelete, 
  enableActions = false,
  onSelectCustomer,
  refreshKey
}: PaginatedCustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [prospectsMap, setProspectsMap] = useState<Record<string, Array<{
    prospect_device_type: string;
    prospect_device_model: string[] | null;
    current_device_model: string | null;
    current_device_model_id: {model: string, type: string} | null;
    memo: string | null;
    created_at: string | null;
  }>>>({});
  
  // 기종 정렬 순서 정의
  const DEVICE_ORDER: Record<string, number> = {
    '트랙터': 1,
    '콤바인': 2,
    '이앙기': 3,
    '작업기': 4,
    '기타': 5,
  };
  
  // 개선된 검색 관련 상태
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  
  const currentPage = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '18');
  const searchTerm = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const inputRef = useRef<HTMLInputElement>(null);

  // 검색 히스토리 로드
  useEffect(() => {
    // 🚀 성능 최적화: 비동기로 localStorage 로드
    const loadSearchHistory = async () => {
      try {
        const savedHistory = localStorage.getItem('customerSearchHistory');
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          setSearchHistory(parsed.map((item: any) => ({
            ...item,
            lastSearched: new Date(item.lastSearched)
          })));
        }
      } catch (error) {
        console.error('검색 히스토리 로드 실패:', error);
      }
    };
    
    // 비동기로 실행하여 초기 렌더링 차단 방지
    loadSearchHistory();
  }, []);

  // 검색 히스토리 저장
  const saveSearchHistory = useCallback((customer: Customer) => {
    setSearchHistory(prev => {
      const existing = prev.find(h => h.customerId === customer.id);
      const updated = existing 
        ? prev.map(h => h.customerId === customer.id 
          ? { ...h, searchCount: h.searchCount + 1, lastSearched: new Date() }
          : h
        )
        : [...prev, {
          customerId: customer.id,
          name: customer.name,
          searchCount: 1,
          lastSearched: new Date()
        }];
      
      // 최대 20개로 제한하고 최신순으로 정렬
      const limited = updated
        .sort((a, b) => b.searchCount - a.searchCount || b.lastSearched.getTime() - a.lastSearched.getTime())
        .slice(0, 20);
      
      // 🚀 성능 최적화: 비동기로 localStorage 저장
      setTimeout(() => {
        try {
          localStorage.setItem('customerSearchHistory', JSON.stringify(limited));
        } catch (error) {
          console.error('검색 히스토리 저장 실패:', error);
        }
      }, 0);
      
      return limited;
    });
  }, []);

  // 개선된 검색 함수 - 확장된 검색 필드
  const performSearch = useCallback((searchTerm: string) => {
    if (searchTerm.trim().length === 0) {
      setFilteredCustomers([]);
      setIsDropdownOpen(false);
      return;
    }

    // 최소 1자 이상 입력하면 검색 실행 (더 빠른 반응)
    if (searchTerm.trim().length < 1) {
      setFilteredCustomers([]);
      setIsDropdownOpen(false);
      return;
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // 🚀 성능 최적화: 메모이제이션된 검색 결과 사용
    const results = data?.data?.filter(c => {
      // 기본 검색 필드 (가장 빠른 필드부터 체크)
      const nameMatch = c.name?.toLowerCase().includes(normalizedSearch);
      if (nameMatch) return true;
      
      const mobileMatch = c.mobile?.replace(/-/g, '').includes(normalizedSearch.replace(/-/g, ''));
      if (mobileMatch) return true;
      
      // 확장된 검색 필드 (필요시에만 체크)
      const addressMatch = c.address?.toLowerCase().includes(normalizedSearch);
      if (addressMatch) return true;
      
      const businessNameMatch = c.business_name?.toLowerCase().includes(normalizedSearch);
      if (businessNameMatch) return true;
      
      const representativeNameMatch = c.representative_name?.toLowerCase().includes(normalizedSearch);
      if (representativeNameMatch) return true;
      
      const phoneMatch = c.phone?.replace(/-/g, '').includes(normalizedSearch.replace(/-/g, ''));
      return phoneMatch;
    }) || [];

    // 검색 히스토리 기반 정렬 (최대 10개로 제한)
    const sortedResults = results
      .sort((a, b) => {
        const aHistory = searchHistory.find(h => h.customerId === a.id);
        const bHistory = searchHistory.find(h => h.customerId === b.id);
        
        // 검색 히스토리가 있는 고객을 우선 표시
        if (aHistory && !bHistory) return -1;
        if (!aHistory && bHistory) return 1;
        if (aHistory && bHistory) {
          // 검색 횟수로 정렬, 같으면 최근 검색순
          if (aHistory.searchCount !== bHistory.searchCount) {
            return bHistory.searchCount - aHistory.searchCount;
          }
          return bHistory.lastSearched.getTime() - aHistory.lastSearched.getTime();
        }
        
        // 히스토리가 없는 경우 이름순
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10); // 최대 10개로 제한

    setFilteredCustomers(sortedResults);
    setIsDropdownOpen(sortedResults.length > 0);
    setSelectedIndex(-1);
  }, [data, searchHistory]);

  // 디바운싱된 검색 함수
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );

  // 검색 입력 처리 - 개선된 버전
  const handleSearchInput = useCallback((value: string) => {
    setSearchInputValue(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredCustomers[selectedIndex]) {
          handleCustomerSelect(filteredCustomers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isDropdownOpen, filteredCustomers, selectedIndex]);

  // 고객 선택 처리 - 개선된 버전
  const handleCustomerSelect = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setFilteredCustomers([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    saveSearchHistory(customer);
    onSelectCustomer?.(customer);
    
    // 선택된 고객 정보를 모달로 표시
    setDetailModalOpen(true);
  }, [saveSearchHistory, onSelectCustomer]);

  // 데이터 페칭 함수
  const fetchCustomers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const fetchParams = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/customers?${fetchParams}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
        if (isRefresh) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, searchTerm, sortBy, sortOrder]);

  // 수동 새로고침 함수 (검색 입력 필드 초기화 포함)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // 검색 입력 필드 초기화
      setSearchInputValue('');
      
      // URL 파라미터에서 search 제거
      const params = new URLSearchParams(searchParams.toString());
      params.delete('search');
      params.set('page', '1');
      router.push(`?${params.toString()}`);
      
      // 초기화된 검색어로 데이터 새로고침
      const fetchParams = new URLSearchParams({
        page: '1',
        pageSize: pageSize.toString(),
        search: '', // 빈 검색어로 설정
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/customers?${fetchParams}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error refreshing customers:', error);
    } finally {
      setRefreshing(false);
    }
  }, [searchParams, router, pageSize, sortBy, sortOrder]);

  // 가망고객 정보 로드
  useEffect(() => {
    async function fetchProspects() {
      if (!data?.data) return;
      
      const map: Record<string, Array<{
        prospect_device_type: string;
        prospect_device_model: string[] | null;
        current_device_model: string | null;
        current_device_model_id: {model: string, type: string} | null;
        memo: string | null;
        created_at: string | null;
      }>> = {};
      
      // 각 고객의 가망고객 정보 조회
      for (const customer of data.data) {
        try {
          const res = await fetch(`/api/prospects?customer_id=${customer.id}`);
          const prospectsData = await res.json();
          if (prospectsData.data && prospectsData.data.length > 0) {
            const prospects = prospectsData.data.map((p: any) => ({
              prospect_device_type: p.prospect_device_type,
              prospect_device_model: Array.isArray(p.prospect_device_model) ? p.prospect_device_model : 
                (p.prospect_device_model ? [p.prospect_device_model] : null),
              current_device_model: p.current_device_model || null,
              current_device_model_id: p.models_types ? {
                model: p.models_types.model,
                type: p.models_types.type,
              } : null,
              memo: p.memo || null,
              created_at: p.created_at || null,
            }));
            
            // 기종 순서로 정렬 (트랙터→콤바인→이앙기→작업기→기타), 같은 기종은 등록순서
            prospects.sort((a: any, b: any) => {
              const orderA = DEVICE_ORDER[a.prospect_device_type] || 99;
              const orderB = DEVICE_ORDER[b.prospect_device_type] || 99;
              if (orderA !== orderB) return orderA - orderB;
              // 같은 기종일 경우 등록순서(created_at)로 정렬
              if (a.created_at && b.created_at) {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              }
              return 0;
            });
            
            map[customer.id] = prospects;
          }
        } catch (error) {
          console.error(`고객 ${customer.id}의 가망고객 정보 로드 실패:`, error);
        }
      }
      
      setProspectsMap(map);
    }
    
    if (data?.data) {
      fetchProspects();
    }
  }, [data]);

  // 초기 로딩 및 의존성 변경 시 데이터 페칭
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers, refreshKey]);

  // 실시간 동기화 - 즉시 데이터 새로고침
  useCustomersRealtime({ 
    onChange: () => {
      // 실시간 변경 시 즉시 새로고침 (로딩 상태 없이)
      fetchCustomers(true);
    }
  });

  // 검색 입력 상태 관리
  const [searchInputValue, setSearchInputValue] = useState(searchTerm);
  
  // URL 파라미터와 검색 입력 필드 동기화
  useEffect(() => {
    setSearchInputValue(searchTerm);
  }, [searchTerm]);
  
  // 수동 검색 실행 함수
  const executeSearch = useCallback(() => {
    if (searchInputValue !== searchTerm) {
      // 최소 2자 이상 입력해야 검색 실행 (1자 입력 시 검색 중단)
      if (searchInputValue.trim().length >= 2 || searchInputValue.trim().length === 0) {
        // 검색 시 첫 페이지로 이동
        const params = new URLSearchParams(searchParams.toString());
        params.set('search', searchInputValue);
        params.set('page', '1');
        router.push(`?${params.toString()}`);
      }
    }
  }, [searchInputValue, searchTerm, searchParams, router]);

  // Enter 키 검색 실행
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  }, [executeSearch]);

  // 정렬 핸들러
  const handleSort = (field: string) => {
    const newSortOrder = (sortBy === field && sortOrder === 'asc') ? 'desc' : 'asc';
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('sortBy', field);
    params.set('sortOrder', newSortOrder);
    params.set('page', '1'); // 정렬 변경 시 첫 페이지로
    router.push(`?${params.toString()}`);
  };

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  // 엑셀 다운로드 핸들러 (전체 데이터 다운로드)
  const handleExcelDownload = async () => {
    try {
      // 전체 고객 데이터 가져오기 (페이지네이션 없이)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '10000', // 충분히 큰 값으로 전체 데이터 가져오기
        search: searchInputValue,
        sortBy: sortBy,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/customers?${params}`, { cache: 'no-store' });
      const result = await res.json();
      
      if (result.error) {
        alert('데이터를 가져오는 중 오류가 발생했습니다: ' + result.error);
        return;
      }

      const allCustomers = Array.isArray(result.data) ? result.data : [];

      if (allCustomers.length === 0) {
        alert('다운로드할 고객 데이터가 없습니다.');
        return;
      }

      // 엑셀 데이터 변환
      const excelRows = allCustomers.map((customer: Customer) => ({
        '고객명': customer.name || '',
        '고객유형': customer.customer_type || '',
        '휴대폰': customer.mobile || '',
        '전화번호': customer.phone || '',
        '도로명주소': customer.address_road || '',
        '지번주소': customer.address_jibun || '',
        '우편번호': customer.zipcode || '',
        '사업자명': customer.business_name || '',
        '대표자명': customer.representative_name || '',
        '사업자번호': customer.business_no || '',
        '거래건수': customer.transaction_count || 0,
        '미수금': customer.total_unpaid || 0,
        '등록일': customer.created_at?.slice(0, 10) || '',
      }));

      // 엑셀 파일 생성
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '고객목록');
      
      // 파일명 생성
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `고객목록_${dateStr}.xlsx`;
      
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('엑셀 다운로드 실패:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 체크박스 핸들러
  const handleCheck = (id: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    if (checked) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    setSelectedIds(newSelectedIds);
  };

  // 체크된 고객 목록
  const checkedCustomers = data?.data?.filter(c => selectedIds.has(c.id)) || [];

  // 로딩 스켈레톤
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 영역 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="flex-1 max-w-2xl">
            {/* 엑셀 다운로드 버튼 */}
            <div className="flex justify-end mb-3">
              <button
                onClick={handleExcelDownload}
                disabled={!data?.data || data.data.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-semibold shadow-sm"
                title="고객 정보 엑셀 다운로드"
              >
                📥 엑셀 다운로드
              </button>
            </div>
            <label className="block text-xl font-bold text-gray-700 mb-3">
              🔍 고객 검색 및 선택
            </label>
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="고객명/전화번호/주소/회사명으로 검색 후 선택하세요"
                value={searchInputValue}
                onChange={(e) => {
                  setSearchInputValue(e.target.value);
                  handleSearchInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  handleSearchKeyDown(e);
                  handleKeyDown(e);
                }}
                onFocus={() => {
                  if (searchInputValue.trim().length >= 1 && filteredCustomers.length > 0) {
                    setIsDropdownOpen(true);
                  }
                }}
                className="w-full px-6 py-4 pr-32 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
                <button
                  onClick={executeSearch}
                  disabled={searchInputValue.trim().length < 1}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-semibold shadow-sm border border-blue-600"
                  title="검색 실행"
                >
                  🔍 검색
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-semibold shadow-sm border border-green-600"
                  title="고객 목록 새로고침"
                >
                  {refreshing ? (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      새로고침
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      🔄 새로고침
                    </span>
                  )}
                </button>
              </div>
              {isDropdownOpen && (
                <ul className="absolute left-0 right-0 bg-white border-2 border-blue-200 rounded-lg shadow-xl z-10 mt-1 max-h-80 overflow-y-auto text-lg">
                  {filteredCustomers.map((c, index) => {
                    const history = searchHistory.find(h => h.customerId === c.id);
                    return (
                      <li
                        key={c.id}
                        className={`px-4 py-4 hover:bg-blue-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${selectedIndex === index ? 'bg-blue-100 font-bold' : ''}`}
                        onClick={() => handleCustomerSelect(c)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onMouseLeave={() => setSelectedIndex(-1)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-lg text-blue-800">{c.name}</span>
                              {history && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                  🔍 {history.searchCount}회
                                </span>
                              )}
                              {c.total_unpaid && c.total_unpaid > 0 && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                  💰 미수금
                                </span>
                              )}
                            </div>
                            <div className="text-gray-600 text-base space-y-1">
                              {c.mobile && <div className="flex items-center gap-2">📱 {c.mobile}</div>}
                              {c.phone && <div className="flex items-center gap-2">📞 {c.phone}</div>}
                              {c.address && <div className="flex items-center gap-2">📍 {c.address}</div>}
                              {c.business_name && <div className="flex items-center gap-2">🏢 {c.business_name}</div>}
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="text-purple-600">거래: {c.transaction_count ?? 0}건</span>
                                <span className="text-red-600">미수금: {c.total_unpaid?.toLocaleString() ?? '0'}원</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <div>클릭하여 선택</div>
                            <div className="text-xs">Enter 키로도 선택 가능</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {filteredCustomers.length === 0 && searchInputValue.trim().length >= 1 && (
                    <li className="px-4 py-4 text-gray-500 text-lg text-center">
                      <div className="mb-2">🔍 검색 결과가 없습니다</div>
                      <div className="text-sm text-gray-400">다른 검색어를 입력해보세요</div>
                    </li>
                  )}
                  {searchInputValue.trim().length === 0 && (
                    <li className="px-4 py-4 text-gray-500 text-lg text-center">
                      <div className="mb-2">💡 검색어를 입력하세요</div>
                      <div className="text-sm text-gray-400">고객명, 전화번호, 주소, 회사명으로 검색 가능</div>
                    </li>
                  )}
                </ul>
              )}
            </div>
            {selectedCustomer && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-green-800">
                      ✅ 선택된 고객: {selectedCustomer.name}
                    </div>
                    <div className="text-sm text-green-600">
                      {selectedCustomer.mobile && `📱 ${selectedCustomer.mobile}`}
                      {selectedCustomer.phone && ` 📞 ${selectedCustomer.phone}`}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setSearchInputValue('');
                      onSelectCustomer?.(null);
                    }}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-600 mb-2">📊 전체 고객 수</div>
            <div className="text-3xl font-bold text-blue-600">
              {data.pagination.total.toLocaleString()}명
            </div>
          </div>
        </div>
      </div>

      {/* 고객 카드 목록 (3열6행 = 18개) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.data.map(customer => (
          <div 
            key={customer.id} 
            className="bg-white rounded-xl shadow-lg border-2 border-gray-200 hover:shadow-xl transition-shadow duration-300 relative cursor-pointer"
            onClick={() => {
              // 고객 선택
              setSelectedCustomer(customer);
              onSelectCustomer?.(customer);
            }}
          >
            {/* 체크박스와 작업 버튼 */}
            <div className="absolute top-4 left-4 z-10">
              <input
                type="checkbox"
                checked={selectedIds.has(customer.id)}
                onChange={e => {
                  e.stopPropagation(); // 이벤트 전파 방지
                  handleCheck(customer.id, e.target.checked);
                }}
                className="w-6 h-6 text-blue-600 rounded border-2 border-gray-300 focus:ring-2 focus:ring-blue-500"
                title="고객 선택"
              />
            </div>
            
            {enableActions && (
              <div className="absolute top-4 right-4 z-10 flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 이벤트 전파 방지
                    onSelectCustomer?.(customer);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-base font-semibold shadow-lg flex items-center gap-1"
                  title="문자 보내기"
                >
                  💬 문자
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 이벤트 전파 방지
                    if (onEdit) {
                      onEdit(customer);
                    }
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 text-base font-semibold shadow-lg"
                  title="수정"
                >
                  ✏️ 수정
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation(); // 이벤트 전파 방지
                    const confirmMessage = `⚠️ 정말로 이 고객을 삭제하시겠습니까?\n\n고객명: ${customer.name}\n거래건수: ${customer.transaction_count ?? 0}건\n미수금: ${customer.total_unpaid ? customer.total_unpaid.toLocaleString() + '원' : '0원'}\n\n⚠️ 고객을 삭제하면 해당 고객의 모든 거래내역도 함께 삭제됩니다!\n이 작업은 되돌릴 수 없습니다.`;
                    
                    if (!window.confirm(confirmMessage)) return;
                    
                    try {
                      // Supabase 세션에서 토큰 가져오기
                      const { createClient } = await import('@supabase/supabase-js');
                      const supabase = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                      );
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token;
                      
                      if (!token) {
                        alert('인증이 필요합니다. 로그인을 다시 해주세요.');
                        return;
                      }
                      
                      const res = await fetch(`/api/customers?id=${customer.id}`, { 
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      });
                      
                      if (res.ok) {
                        alert('고객과 관련된 모든 데이터가 삭제되었습니다.');
                        // 삭제 후 목록 강제 새로고침
                        await fetchCustomers(true);
                        // 페이지 새로고침으로 확실히 갱신
                        router.refresh();
                      } else {
                        const { error } = await res.json();
                        alert('삭제 실패: ' + error);
                      }
                    } catch (error) {
                      console.error('삭제 중 오류:', error);
                      alert('삭제 중 오류가 발생했습니다.');
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 text-base font-semibold shadow-lg"
                  title="삭제"
                >
                  🗑️ 삭제
                </button>
              </div>
            )}

            {/* 카드 내용 */}
            <div className="p-6 pt-16">
                              {/* 고객 기본 정보 */}
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mb-4">
                                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                      👤 {customer.name}
                    </h3>
                  {customer.business_name && (
                    <span className="text-lg text-blue-600 font-semibold">
                      {customer.business_name}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="text-sm font-semibold text-blue-700 block mb-1">🏷️ 고객유형</span>
                    <span className="text-lg font-semibold text-blue-800">
                      {Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? 
                        customer.customer_type_multi.join(', ') : 
                        customer.customer_type || '-'
                      }
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-blue-700 block mb-1">📊 거래건수</span>
                    <span className="text-xl font-bold text-purple-800">
                      {customer.transaction_count ?? 0}건
                    </span>
                  </div>
                </div>
              </div>

              {/* 가망기종 현황 */}
              {prospectsMap[customer.id] && prospectsMap[customer.id].length > 0 && (
                <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200 mb-4">
                  <h4 className="text-lg font-bold text-orange-800 mb-2 flex items-center gap-2">
                    🎯 가망기종 현황
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {prospectsMap[customer.id].map((prospect, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-sm font-semibold">
                            가망기종: {prospect.prospect_device_type}
                          </span>
                          {prospect.prospect_device_model && prospect.prospect_device_model.length > 0 && (
                            <>
                              {prospect.prospect_device_model.map((model, modelIdx) => (
                                <span key={modelIdx} className="bg-orange-300 text-orange-900 px-2 py-1 rounded text-sm font-semibold">
                                  모델: {model}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                        {(prospect.current_device_model || prospect.current_device_model_id) && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            현재보유 모델: {prospect.current_device_model || 
                              (prospect.current_device_model_id ? `${prospect.current_device_model_id.model} / ${prospect.current_device_model_id.type}` : '')}
                          </span>
                        )}
                        {prospect.memo && (
                          <div className="w-full mt-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs whitespace-pre-wrap">
                            📝 {prospect.memo}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미수금 정보 */}
              <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200 mb-4">
                                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-red-800 flex items-center gap-2">
                      💰 미수금
                    </h4>
                  <div className="text-right">
                    {customer.total_unpaid && customer.total_unpaid > 0 ? (
                      <span className="text-3xl font-bold text-red-700">
                        {customer.total_unpaid.toLocaleString()}원
                      </span>
                    ) : (
                      <span className="text-2xl text-gray-400">0원</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 메모 */}
              {customer.memo && (
                <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200 mb-4">
                  <h4 className="text-lg font-bold text-indigo-800 mb-2 flex items-center gap-2">
                    📝 메모
                  </h4>
                  <p className="text-base text-gray-800 whitespace-pre-wrap break-words">
                    {customer.memo}
                  </p>
                </div>
              )}

              {/* 연락처 정보 */}
              <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200 mb-4">
                <h4 className="text-lg font-bold text-indigo-800 mb-3 flex items-center gap-2">
                  📞 연락처
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.mobile && (
                    <div>
                      <span className="text-sm font-semibold text-indigo-700 block mb-2">📱 휴대폰</span>
                      <a
                        href={`tel:${customer.mobile.replace(/[^0-9]/g, '')}`}
                        className="inline-block px-3 py-2 bg-indigo-100 border-2 border-indigo-300 rounded-lg text-base font-bold text-indigo-700 hover:bg-indigo-200 hover:border-indigo-500 transition-all duration-200 shadow-sm hover:shadow-md"
                        title="📞 터치하여 전화 걸기"
                      >
                        {customer.mobile}
                      </a>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <span className="text-sm font-semibold text-indigo-700 block mb-2">☎️ 일반전화</span>
                      <a
                        href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                        className="inline-block px-3 py-2 bg-indigo-100 border-2 border-indigo-300 rounded-lg text-base font-bold text-indigo-700 hover:bg-indigo-200 hover:border-indigo-500 transition-all duration-200 shadow-sm hover:shadow-md"
                        title="📞 터치하여 전화 걸기"
                      >
                        {customer.phone}
                      </a>
                    </div>
                  )}
                  {customer.fax && (
                    <div>
                      <span className="text-sm font-semibold text-indigo-700 block mb-1">📠 팩스</span>
                      <span className="text-lg text-indigo-800">{customer.fax}</span>
                    </div>
                  )}
                </div>
                {!customer.mobile && !customer.phone && !customer.fax && (
                  <span className="text-lg text-gray-400">연락처 정보 없음</span>
                )}
              </div>

              {/* 주소 정보 */}
              <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200 mb-4">
                <h4 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                  🏠 주소
                </h4>
                <div className="space-y-3">
                  {customer.address_road && (
                    <div>
                      <span className="text-sm font-semibold text-green-700 block mb-1">도로명주소</span>
                      <button
                        onClick={() => openKakaoMap(customer.address_road!)}
                        className="text-lg text-green-600 underline hover:text-green-800 font-medium text-left block"
                        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        title="카카오맵에서 보기"
                      >
                        {customer.address_road}
                      </button>
                    </div>
                  )}
                  {customer.address_jibun && (
                    <div>
                      <span className="text-sm font-semibold text-green-700 block mb-1">지번주소</span>
                      <button
                        onClick={() => openKakaoMap(customer.address_jibun!)}
                        className="text-lg text-green-600 underline hover:text-green-800 font-medium text-left block"
                        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        title="카카오맵에서 보기"
                      >
                        {customer.address_jibun}
                      </button>
                    </div>
                  )}
                  {customer.zipcode && (
                    <div>
                      <span className="text-sm font-semibold text-green-700 block mb-1">우편번호</span>
                      <span className="text-lg text-green-800">{customer.zipcode}</span>
                    </div>
                  )}
                  {!customer.address_road && !customer.address_jibun && !customer.zipcode && (
                    <span className="text-lg text-gray-400">주소 정보 없음</span>
                  )}
                </div>
              </div>

              {/* 추가 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 사업자 정보 */}
                <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                  <h5 className="text-base font-bold text-yellow-800 mb-2">🏢 사업자 정보</h5>
                  <div className="space-y-2">
                    {customer.business_no && (
                      <div>
                        <span className="text-sm font-semibold text-yellow-700 block">사업자번호</span>
                        <span className="text-base font-semibold text-yellow-800">{customer.business_no}</span>
                      </div>
                    )}
                    {customer.ssn && (
                      <div>
                        <span className="text-sm font-semibold text-yellow-700 block">주민등록번호</span>
                        <span className="text-base font-semibold text-yellow-800">{customer.ssn}</span>
                      </div>
                    )}
                    {!customer.business_no && !customer.ssn && (
                      <span className="text-base text-gray-400">사업자 정보 없음</span>
                    )}
                  </div>
                </div>

                {/* 사진 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                  <h5 className="text-base font-bold text-gray-800 mb-2">📷 사진</h5>
                  {customer.photos && customer.photos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {customer.photos.slice(0, 4).map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo.url}
                          alt="고객사진"
                          className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80 border-2 border-gray-300 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation(); // 이벤트 전파 방지
                            window.open(photo.url, '_blank');
                          }}
                        />
                      ))}
                      {customer.photos.length > 4 && (
                        <div className="w-16 h-16 rounded-lg bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600">
                          +{customer.photos.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-base text-gray-400">사진 없음</span>
                  )}
                </div>
                
                {/* 고객 선택 버튼 */}
                <div className="mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // 이벤트 전파 방지
                      setSelectedCustomer(customer);
                      onSelectCustomer?.(customer);
                    }}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-lg font-semibold shadow-lg"
                    title="이 고객을 SMS 발송 대상으로 선택"
                  >
                    ✅ 고객 선택
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 데이터가 없을 때 */}
      {data.data.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg shadow-lg">
          <div className="text-2xl text-gray-400 font-semibold mb-4">
            {searchTerm ? '🔍 검색 결과가 없습니다' : '👥 등록된 고객이 없습니다'}
          </div>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchInputValue('');
                const params = new URLSearchParams(searchParams.toString());
                params.delete('search');
                router.push(`?${params.toString()}`);
              }}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-lg font-semibold"
            >
              🔄 검색 조건 초기화
            </button>
          )}
        </div>
      )}

      {/* 페이지네이션 */}
      {data.pagination.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <div className="text-center mb-6">
            <div className="text-lg font-semibold text-gray-600 mb-2">
              📄 페이지 정보
            </div>
            <div className="text-xl text-blue-600">
              {data.pagination.page} / {data.pagination.totalPages} 페이지
            </div>
          </div>
                      <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              totalItems={data.pagination.total}
              itemsPerPage={data.pagination.pageSize}
              onPageChange={handlePageChange}
              pageSizeOptions={[10, 18, 20, 30, 50]}
              className="mt-6"
            />
        </div>
      )}

      {/* 로딩 오버레이 */}
      {(loading || refreshing) && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              <div className="text-xl font-semibold text-gray-700">
                {refreshing ? '고객 목록을 새로고침하는 중...' : '고객 목록을 불러오는 중...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 메시지 */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-green-600 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <div className="font-bold text-lg">새로고침 완료!</div>
              <div className="text-sm opacity-90">고객 목록이 업데이트되었습니다.</div>
            </div>
          </div>
        </div>
      )}

      {/* 고객 상세 모달 */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
        />
      )}
    </div>
  );
}

export function PaginatedCustomerList(props: PaginatedCustomerListProps) {
  return (
    <Suspense fallback={<div>고객 목록 불러오는 중...</div>}>
      <PaginatedCustomerListInner {...props} />
    </Suspense>
  );
} 