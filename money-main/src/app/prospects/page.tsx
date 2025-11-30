"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import ScrollToTop from '@/components/ui/scroll-to-top';
import { useCustomersRealtime } from '@/lib/useCustomersRealtime';
import { supabase } from '@/lib/supabase';

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
  customers: {
    id: string;
    name: string;
    mobile: string | null;
    phone: string | null;
    address_road: string | null;
    address_jibun: string | null;
    business_name: string | null;
    customer_type: string | null;
  };
  models_types: {
    id: string;
    model: string;
    type: string;
  } | null;
};

type ApiResponse = {
  data: Prospect[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type Stats = {
  트랙터: number;
  콤바인: number;
  이앙기: number;
  작업기: number;
  기타: number;
  total: number;
};

const DEVICE_TYPES = ['트랙터', '콤바인', '이앙기', '작업기', '기타'] as const;

const DEVICE_ICONS = {
  트랙터: '🚜',
  콤바인: '🌾',
  이앙기: '🌱',
  작업기: '⚙️',
  기타: '📦',
} as const;

const DEVICE_COLORS = {
  트랙터: {
    bg: 'bg-blue-50',
    bgLight: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700',
    textBold: 'text-blue-800',
    badge: 'bg-blue-500 text-white',
  },
  콤바인: {
    bg: 'bg-green-50',
    bgLight: 'bg-green-100',
    border: 'border-green-300',
    text: 'text-green-700',
    textBold: 'text-green-800',
    badge: 'bg-green-500 text-white',
  },
  이앙기: {
    bg: 'bg-purple-50',
    bgLight: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-700',
    textBold: 'text-purple-800',
    badge: 'bg-purple-500 text-white',
  },
  작업기: {
    bg: 'bg-orange-50',
    bgLight: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-700',
    textBold: 'text-orange-800',
    badge: 'bg-orange-500 text-white',
  },
  기타: {
    bg: 'bg-gray-50',
    bgLight: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-700',
    textBold: 'text-gray-800',
    badge: 'bg-gray-500 text-white',
  },
} as const;

// 수정 모달 컴포넌트
function EditProspectModal({ 
  prospect, 
  isOpen, 
  onClose, 
  onSave 
}: { 
  prospect: Prospect | null; 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: () => void;
}) {
  const [deviceType, setDeviceType] = useState<string>('');
  const [prospectModel, setProspectModel] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prospect && isOpen) {
      setDeviceType(prospect.prospect_device_type);
      setProspectModel(prospect.prospect_device_model?.join(', ') || '');
      setCurrentModel(prospect.current_device_model || '');
      setMemo(prospect.memo || '');
    }
  }, [prospect, isOpen]);

  if (!isOpen || !prospect) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        prospect_device_type: deviceType as '트랙터' | '콤바인' | '이앙기' | '작업기' | '기타',
        prospect_device_model: prospectModel ? prospectModel.split(',').map(m => m.trim()).filter(m => m) : null,
        current_device_model: currentModel || null,
        memo: memo || null,
        updated_at: new Date().toISOString(),
      };

      console.log('🔍 수정 요청 데이터:', {
        id: prospect.id,
        기존_기종: prospect.prospect_device_type,
        변경_기종: deviceType,
        updateData
      });

      const { data, error } = await supabase
        .from('customer_prospects')
        .update(updateData)
        .eq('id', prospect.id)
        .select()
        .single();

      if (error) {
        console.error('❌ 수정 실패:', error);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        alert('수정에 실패했습니다: ' + error.message);
        return;
      }

      console.log('✅ 수정 성공:', data);
      alert(`수정되었습니다.\n기종: ${prospect.prospect_device_type} → ${deviceType}`);
      onSave();
      onClose();
    } catch (error) {
      console.error('수정 중 오류:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            ✏️ 가망고객 정보 수정
          </h2>
          <p className="text-blue-100 mt-1">고객: {prospect.customers.name}</p>
        </div>

        {/* 모달 바디 */}
        <div className="p-6 space-y-6">
          {/* 가망기종 */}
          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              🎯 가망기종 *
            </label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {DEVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DEVICE_ICONS[type]} {type}
                </option>
              ))}
            </select>
          </div>

          {/* 가망모델 */}
          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              📋 가망모델
            </label>
            <input
              type="text"
              value={prospectModel}
              onChange={(e) => setProspectModel(e.target.value)}
              placeholder="예: L47H, MR877 (콤마로 구분)"
              className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <p className="text-sm text-gray-500 mt-1">여러 모델은 콤마(,)로 구분하세요</p>
          </div>

          {/* 현재보유 모델 */}
          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              📦 현재보유 모델
            </label>
            <input
              type="text"
              value={currentModel}
              onChange={(e) => setCurrentModel(e.target.value)}
              placeholder="예: L45SV / 트랙터"
              className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              📝 메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="구매 예정 시기, 예산, 특이사항 등을 메모하세요"
              className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
            />
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-4 justify-end">
          <Button
            onClick={onClose}
            className="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-lg font-bold"
            disabled={saving}
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-lg font-bold"
            disabled={saving}
          >
            {saving ? '저장 중...' : '💾 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 삭제 확인 모달
function DeleteConfirmModal({
  prospect,
  isOpen,
  onClose,
  onConfirm,
}: {
  prospect: Prospect | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !prospect) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('customer_prospects')
        .delete()
        .eq('id', prospect.id);

      if (error) {
        console.error('삭제 실패:', error);
        alert('삭제에 실패했습니다: ' + error.message);
        return;
      }

      // Supabase 동기화를 위한 딜레이 후 새로고침
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onClose();
      onConfirm();
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('삭제 중 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* 모달 헤더 */}
        <div className="bg-red-600 text-white px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            ⚠️ 삭제 확인
          </h2>
        </div>

        {/* 모달 바디 */}
        <div className="p-6">
          <div className="text-center">
            <div className="text-6xl mb-4">🗑️</div>
            <p className="text-xl text-gray-700 mb-2">
              <span className="font-bold text-gray-900">{prospect.customers.name}</span>님의
            </p>
            <p className="text-xl text-gray-700 mb-4">
              <span className="font-bold text-blue-600">{prospect.prospect_device_type}</span> 가망정보를 삭제하시겠습니까?
            </p>
            <p className="text-base text-red-600 font-semibold">
              이 작업은 되돌릴 수 없습니다!
            </p>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-4 justify-center">
          <Button
            onClick={onClose}
            className="px-8 py-3 bg-gray-400 hover:bg-gray-500 text-lg font-bold"
            disabled={deleting}
          >
            취소
          </Button>
          <Button
            onClick={handleDelete}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-lg font-bold"
            disabled={deleting}
          >
            {deleting ? '삭제 중...' : '🗑️ 삭제'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProspectsPageContent() {
  useCustomersRealtime();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  const currentPage = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');
  const searchTerm = searchParams.get('search') || '';
  const deviceType = searchParams.get('deviceType') || '전체';

  // 데이터 fetch 함수 (캐시 무시하여 항상 최신 데이터)
  const fetchData = async () => {
    try {
      // 통계 (캐시 무시)
      const statsRes = await fetch('/api/prospects/stats', { cache: 'no-store' });
      const statsData = await statsRes.json();
      setStats(statsData);

      // 목록 (캐시 무시)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
        deviceType: deviceType === '전체' ? '' : deviceType,
      });

      const res = await fetch(`/api/prospects?${params}`, { cache: 'no-store' });
      const result = await res.json();
      
      if (result.error) {
        console.error('API 에러:', result.error);
        setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
      } else {
        setData({
          data: Array.isArray(result.data) ? result.data : [],
          pagination: result.pagination || { page: 1, pageSize, total: 0, totalPages: 0 },
        });
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
    }
  };

  // 통계 데이터 로드 (캐시 무시)
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/prospects/stats', { cache: 'no-store' });
        const statsData = await res.json();
        setStats(statsData);
      } catch (error) {
        console.error('통계 로드 실패:', error);
      }
    }
    fetchStats();
  }, []);

  // 가망고객 목록 로드 (캐시 무시)
  useEffect(() => {
    async function fetchProspects() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          pageSize: pageSize.toString(),
          search: searchTerm,
          deviceType: deviceType === '전체' ? '' : deviceType,
        });

        console.log('🔍 가망고객 목록 API 호출:', `/api/prospects?${params}`);
        const res = await fetch(`/api/prospects?${params}`, { cache: 'no-store' });
        const result = await res.json();
        
        console.log('📦 API 응답:', result);
        console.log('📊 데이터 개수:', result.data?.length || 0);
        
        if (result.error) {
          console.error('❌ API 에러:', result.error);
          setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
        } else {
          setData({
            data: Array.isArray(result.data) ? result.data : [],
            pagination: result.pagination || { page: 1, pageSize, total: 0, totalPages: 0 },
          });
          console.log('✅ 데이터 설정 완료:', Array.isArray(result.data) ? result.data.length : 0, '건');
        }
      } catch (error) {
        console.error('❌ 가망고객 목록 로드 실패:', error);
        setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
      } finally {
        setLoading(false);
      }
    }
    fetchProspects();
  }, [currentPage, pageSize, searchTerm, deviceType]);

  // 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // 검색 실행
  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', searchTerm);
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  // 기종 필터 변경
  const handleDeviceTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('deviceType', type);
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  // 고객 상세 페이지로 이동
  const handleCustomerClick = (customerId: string) => {
    router.push(`/customers/${customerId}`);
  };

  // 수정 클릭
  const handleEditClick = (e: React.MouseEvent, prospect: Prospect) => {
    e.stopPropagation();
    setSelectedProspect(prospect);
    setEditModalOpen(true);
  };

  // 삭제 클릭
  const handleDeleteClick = (e: React.MouseEvent, prospect: Prospect) => {
    e.stopPropagation();
    setSelectedProspect(prospect);
    setDeleteModalOpen(true);
  };

  // 수정/삭제 후 새로고침
  const handleModalSuccess = () => {
    handleRefresh();
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <div className="text-2xl font-bold">로딩 중...</div>
        </div>
      </div>
    );
  }

  // 기종별로 그룹핑
  const groupedByType = data?.data?.reduce((acc, prospect) => {
    const type = prospect.prospect_device_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(prospect);
    return acc;
  }, {} as Record<string, Prospect[]>) || {};

  // 테이블 행 렌더링 함수 - 순서: 고객명/가망모델/보유모델/연락처/주소/등록일/관리
  const renderTableRow = (prospect: Prospect, idx: number, colors: typeof DEVICE_COLORS[keyof typeof DEVICE_COLORS]) => (
    <tr 
      key={prospect.id} 
      className={`${idx % 2 === 0 ? 'bg-white' : colors.bg} hover:bg-yellow-50 transition-colors border-b border-gray-200`}
    >
      {/* 고객명 */}
      <td 
        className="px-6 py-4 cursor-pointer text-center"
        onClick={() => handleCustomerClick(prospect.customer_id)}
      >
        <div className="text-xl font-bold text-gray-800 hover:text-blue-600">{prospect.customers.name}</div>
        {prospect.customers.customer_type && (
          <div className="text-sm text-gray-500">{prospect.customers.customer_type}</div>
        )}
      </td>
      {/* 가망모델 */}
      <td className="px-6 py-4">
        {prospect.prospect_device_model && prospect.prospect_device_model.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {prospect.prospect_device_model.map((model, i) => (
              <span key={i} className={`px-3 py-1 rounded-lg text-base font-semibold ${colors.badge}`}>
                {model}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-base">미정</span>
        )}
      </td>
      {/* 보유모델 */}
      <td className="px-6 py-4">
        {prospect.current_device_model ? (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-base font-semibold">
            {prospect.current_device_model}
          </span>
        ) : prospect.models_types ? (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-base font-semibold">
            {prospect.models_types.model} / {prospect.models_types.type}
          </span>
        ) : (
          <span className="text-gray-400 text-base">없음</span>
        )}
      </td>
      {/* 연락처 */}
      <td className="px-6 py-4">
        <div className="text-lg text-gray-700">
          {prospect.customers.mobile || prospect.customers.phone || '-'}
        </div>
      </td>
      {/* 주소 */}
      <td className="px-6 py-4 max-w-xs">
        <div className="text-base text-gray-600 truncate">
          {prospect.customers.address_road || prospect.customers.address_jibun || '-'}
        </div>
      </td>
      {/* 메모 */}
      <td className="px-4 py-4 min-w-[200px] max-w-[300px]">
        {prospect.memo ? (
          <div className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
            📝 {prospect.memo}
          </div>
        ) : (
          <span className="text-gray-300 text-sm">-</span>
        )}
      </td>
      {/* 등록일 */}
      <td className="px-6 py-4 text-base text-gray-500 text-center">
        {new Date(prospect.created_at).toLocaleDateString('ko-KR')}
      </td>
      {/* 관리 */}
      <td className="px-4 py-4">
        <div className="flex gap-2 justify-center">
          <button
            onClick={(e) => handleEditClick(e, prospect)}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors"
            title="수정"
          >
            ✏️
          </button>
          <button
            onClick={(e) => handleDeleteClick(e, prospect)}
            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors"
            title="삭제"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );

  // 테이블 헤더 렌더링 함수 - 가운데 정렬
  const renderTableHeader = (bgClass: string) => (
    <thead className={bgClass}>
      <tr>
        <th className="px-6 py-4 text-center text-lg font-bold text-gray-700">고객명</th>
        <th className="px-6 py-4 text-center text-lg font-bold text-gray-700">🎯 가망모델</th>
        <th className="px-6 py-4 text-center text-lg font-bold text-gray-700">📦 보유모델</th>
        <th className="px-6 py-4 text-center text-lg font-bold text-gray-700">연락처</th>
        <th className="px-6 py-4 text-center text-lg font-bold text-gray-700">주소</th>
        <th className="px-4 py-4 text-center text-lg font-bold text-gray-700">📝 메모</th>
        <th className="px-6 py-4 text-center text-lg font-bold text-gray-700">등록일</th>
        <th className="px-4 py-4 text-center text-lg font-bold text-gray-700">관리</th>
      </tr>
    </thead>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />
      
      {/* 수정 모달 */}
      <EditProspectModal
        prospect={selectedProspect}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleModalSuccess}
      />

      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        prospect={selectedProspect}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleModalSuccess}
      />

      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 flex items-center gap-3">
            🎯 가망고객 관리
          </h1>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-lg font-bold"
          >
            {refreshing ? '🔄 새로고침 중...' : '🔄 새로고침'}
          </Button>
        </div>

        {/* 통계 대시보드 - 클릭 가능한 필터 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <button
              className={`bg-white rounded-xl shadow-lg p-5 border-2 transition-all hover:shadow-xl ${
                deviceType === '전체' ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => handleDeviceTypeChange('전체')}
            >
              <div className="text-lg font-bold text-gray-600 mb-2">📊 전체</div>
              <div className="text-3xl font-bold text-gray-800">{stats.total}<span className="text-lg font-normal text-gray-500">명</span></div>
            </button>
            {DEVICE_TYPES.map((type) => {
              const colors = DEVICE_COLORS[type];
              const icon = DEVICE_ICONS[type];
              const isActive = deviceType === type;
              return (
                <button
                  key={type}
                  className={`${colors.bg} rounded-xl shadow-lg p-5 ${colors.border} border-2 transition-all hover:shadow-xl ${
                    isActive ? 'ring-2 ring-offset-1 ring-blue-400' : ''
                  }`}
                  onClick={() => handleDeviceTypeChange(type)}
                >
                  <div className={`text-lg font-bold ${colors.text} mb-2`}>{icon} {type}</div>
                  <div className={`text-3xl font-bold ${colors.textBold}`}>{stats[type]}<span className="text-lg font-normal opacity-70">명</span></div>
                </button>
              );
            })}
          </div>
        )}

        {/* 검색 바 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-blue-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                type="text"
                placeholder="🔍 고객명, 연락처로 검색..."
                value={searchTerm}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('search', e.target.value);
                  router.push(`?${params.toString()}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1 text-lg px-5 py-4 border-2 border-blue-200 rounded-lg focus:border-blue-500"
              />
              <Button
                onClick={handleSearch}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-lg font-bold"
              >
                검색
              </Button>
            </div>
          </div>
        </div>

        {/* 가망고객 테이블 - 기종별 그룹 (항상 모든 기종 표시) */}
        <div className="space-y-8">
          {deviceType === '전체' ? (
            // 전체 보기: 모든 기종 섹션 항상 표시
            DEVICE_TYPES.map((type) => {
              const prospects = groupedByType[type] || [];
              const colors = DEVICE_COLORS[type];
              const icon = DEVICE_ICONS[type];
              const count = stats?.[type] || 0;
              
              return (
                <div key={type} className={`${colors.bg} rounded-2xl shadow-lg border-2 ${colors.border} overflow-hidden`}>
                  {/* 섹션 헤더 */}
                  <div className={`${colors.bgLight} px-6 py-4 border-b-2 ${colors.border}`}>
                    <h2 className={`text-2xl font-bold ${colors.textBold} flex items-center gap-3`}>
                      <span className="text-3xl">{icon}</span>
                      {type} 구매 희망 고객
                      <span className={`ml-3 px-4 py-1 rounded-full text-lg ${colors.badge}`}>
                        {count}명
                      </span>
                    </h2>
                  </div>
                  
                  {/* 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      {renderTableHeader(colors.bgLight)}
                      <tbody>
                        {prospects.length > 0 ? (
                          prospects.map((prospect, idx) => renderTableRow(prospect, idx, colors))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center">
                              <div className="text-gray-400 text-lg">
                                {icon} {type} 구매 희망 고객이 없습니다
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          ) : (
            // 특정 기종 필터 시: 단일 테이블
            <div className={`${DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.bg || 'bg-white'} rounded-2xl shadow-lg border-2 ${DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.border || 'border-gray-200'} overflow-hidden`}>
              <div className={`${DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.bgLight || 'bg-gray-100'} px-6 py-4 border-b-2 ${DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.border || 'border-gray-200'}`}>
                <h2 className={`text-2xl font-bold ${DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.textBold || 'text-gray-800'} flex items-center gap-3`}>
                  <span className="text-3xl">{DEVICE_ICONS[deviceType as keyof typeof DEVICE_ICONS] || '📋'}</span>
                  {deviceType} 구매 희망 고객
                  <span className={`ml-3 px-4 py-1 rounded-full text-lg ${DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.badge || 'bg-gray-500 text-white'}`}>
                    {data?.pagination.total || 0}명
                  </span>
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  {renderTableHeader(DEVICE_COLORS[deviceType as keyof typeof DEVICE_COLORS]?.bgLight || 'bg-gray-100')}
                  <tbody>
                    {data && data.data && data.data.length > 0 ? (
                      data.data.map((prospect, idx) => {
                        const colors = DEVICE_COLORS[prospect.prospect_device_type];
                        return renderTableRow(prospect, idx, colors);
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="text-gray-400 text-lg">
                            {DEVICE_ICONS[deviceType as keyof typeof DEVICE_ICONS]} {deviceType} 구매 희망 고객이 없습니다
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 페이지네이션 */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={data.pagination.page}
                totalPages={data.pagination.totalPages}
                totalItems={data.pagination.total}
                itemsPerPage={pageSize}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">가망고객 목록을 불러오는 중...</p>
        </div>
      </div>
    }>
      <ProspectsPageContent />
    </Suspense>
  );
}
